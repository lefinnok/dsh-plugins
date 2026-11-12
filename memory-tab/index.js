/**
 * Host half of the Memory tab (`@local/dsh-memory`).
 *
 * A file-backed, MiMoCode-compatible memory store: plain Markdown under
 * `<DSH_HOME>/memory`, scoped to the project, the session, and the user.
 * Markdown keeps memory greppable, diffable, and human-editable; the BM25
 * index is a derived cache rebuilt from file mtimes on every read.
 *
 * Layout (mirrors MiMoCode so the two tools can share a directory):
 *   memory/global/MEMORY.md
 *   memory/projects/<key>/MEMORY.md
 *   memory/sessions/<sessionId>/notes.md
 *   memory/settings.json
 *
 * Three host surfaces:
 *   - a system-prompt section that makes the model aware of memory and shows
 *     the project/global bodies within a character budget;
 *   - `memory_search` / `memory_write` tools for recall and recording;
 *   - authenticated `/api/memory.*` routes for the Web tab and its settings page.
 *
 * An existing MiMoCode install is read in place: the project id comes from the
 * same `<git-common-dir>/mimocode-project-id` file MiMoCode writes, so opening
 * a workspace MiMoCode already knows offers its memory for import.
 *
 * @module @local/dsh-memory
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

/** The plugin needs the authenticated fetch registry, the tool registry, and prompt inputs. */
export const inject = ['connection', 'tools', 'systemPrompt']

/** Upper bounds that keep the scan cheap on a large memory directory. */
const MAX_FILES = 400
const MAX_FILE_BYTES = 512 * 1024
const MAX_INDEXED_BYTES = 200 * 1024
const MAX_DEPTH = 5

/** BM25 constants (the same shape MiMoCode uses for its SQLite FTS index). */
const K1 = 1.2
const B = 0.75
const SCORE_FLOOR = 0.15

/** Prompt-section placement: after every tool description, before runtime facts. */
const PROMPT_SECTION_ORDER = 3000

/** Memory behaviour the settings page and `settings.json` control. */
const DEFAULT_SETTINGS = {
  enabled: true,
  injectProject: true,
  injectGlobal: true,
  injectSessionNotes: false,
  showHint: true,
  autoImportMimoCode: false,
  maxChars: 4000,
  searchLimit: 8,
}

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const WORD = /[A-Za-z0-9_]/

/**
 * Tokenize text for search: ASCII word runs lowercased, CJK characters as
 * unigrams (MiMoCode indexes CJK the same way, because FTS5 has no Chinese
 * word segmenter).
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  const out = []
  let buf = ''
  for (const ch of text) {
    if (WORD.test(ch)) {
      buf += ch
      continue
    }
    if (buf) {
      out.push(buf.toLowerCase())
      buf = ''
    }
    if (CJK.test(ch)) out.push(ch)
  }
  if (buf) out.push(buf.toLowerCase())
  return out
}

/** @param {string} rel */
function scopeOf(rel) {
  if (rel === 'global' || rel.startsWith('global/')) return 'global'
  if (rel.startsWith('sessions/')) return 'session'
  if (rel.startsWith('projects/')) return 'project'
  return 'other'
}

/** @param {string} rel */
function typeOf(rel) {
  if (/(^|\/)MEMORY\.md$/i.test(rel)) return 'memory'
  if (/(^|\/)checkpoint(-\d+)?\.md$/i.test(rel)) return 'checkpoint'
  if (/(^|\/)notes\.md$/i.test(rel)) return 'notes'
  if (/\/tasks\/[^/]+\/progress\.md$/.test(rel)) return 'progress'
  return 'free'
}

/** @param {string} cwd */
function projectKey(cwd) {
  const name = (basename(cwd) || 'project').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40) || 'project'
  const hash = createHash('sha256').update(cwd).digest('hex').slice(0, 8)
  return `${name}-${hash}`
}

/**
 * Reject anything that could escape the memory root or name a non-Markdown
 * path. The file component, not the whole path, is what a caller supplies.
 * @param {string} value
 */
function safeRelative(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null
  if (value.includes('\0') || value.startsWith('/') || value.includes('\\')) return null
  const segments = value.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return null
  if (!/\.md$/i.test(value)) return null
  return segments.join('/')
}

/**
 * Coerce a settings patch into the known fields with bounded numbers.
 * @param {unknown} raw
 */
function normalizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS }
  if (!raw || typeof raw !== 'object') return out
  for (const key of ['enabled', 'injectProject', 'injectGlobal', 'injectSessionNotes', 'showHint', 'autoImportMimoCode']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key]
  }
  const chars = Number(raw.maxChars)
  if (Number.isFinite(chars)) out.maxChars = Math.min(Math.max(Math.round(chars), 500), 50000)
  const limit = Number(raw.searchLimit)
  if (Number.isFinite(limit)) out.searchLimit = Math.min(Math.max(Math.round(limit), 1), 30)
  return out
}

/** Strip one leading `# …` line and any leading blank lines. */
function stripLeadingTitle(text) {
  return String(text).replace(/^\uFEFF/, '').replace(/^#\s+[^\n]*\n+/, '').replace(/^\n+/, '')
}

export function apply(ctx) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const root = join(home, 'memory')
  const settingsPath = join(root, 'settings.json')

  /** abs path -> indexed document (body + BM25 terms), invalidated by mtime. */
  const docs = new Map()
  /** sessionId -> resolved project descriptor. */
  const projects = new Map()
  /** projectKey -> cached MiMoCode detection (the filesystem probe is not free). */
  const mimoDetections = new Map()
  /** Cached settings read, invalidated by the settings file's mtime. */
  let settingsCache = { mtimeMs: -1, value: { ...DEFAULT_SETTINGS } }
  /** cwd -> project anchor (git top level), so subdirectories share one scope. */
  const anchors = new Map()

  // --------------------------------------------------------------- settings

  function readSettings() {
    try {
      const info = statSync(settingsPath)
      if (info.mtimeMs === settingsCache.mtimeMs) return settingsCache.value
      const value = normalizeSettings(JSON.parse(readFileSync(settingsPath, 'utf8')))
      settingsCache = { mtimeMs: info.mtimeMs, value }
      return value
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  /** @param {Record<string, unknown>} patch */
  async function writeSettings(patch) {
    const next = normalizeSettings({ ...readSettings(), ...(patch && typeof patch === 'object' ? patch : {}) })
    await mkdir(root, { recursive: true })
    await writeAtomic(settingsPath, `${JSON.stringify(next, null, 2)}\n`)
    try {
      settingsCache = { mtimeMs: statSync(settingsPath).mtimeMs, value: next }
    } catch {
      settingsCache = { mtimeMs: -1, value: next }
    }
    return next
  }

  // --------------------------------------------------------------- plumbing

  async function writeAtomic(abs, text) {
    await mkdir(dirname(abs), { recursive: true })
    const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tmp, text, 'utf8')
    await rename(tmp, abs)
  }

  function toRel(abs) {
    return relative(root, abs).split(sep).join('/')
  }

  function absOf(rel) {
    const abs = resolve(root, rel)
    if (abs !== root && !abs.startsWith(root + sep)) return null
    return abs
  }

  function readIfExists(abs) {
    try {
      return readFileSync(abs, 'utf8')
    } catch {
      return null
    }
  }

  /** @param {string} file */
  function readTrimmed(file) {
    try {
      return readFileSync(file, 'utf8').trim() || null
    } catch {
      return null
    }
  }

  /**
   * Resolve the working directory of a session. The in-memory store answers
   * synchronously for live sessions; session history answers for any other.
   * @param {string} sessionId
   * @returns {Promise<string | null>}
   */
  async function cwdOf(sessionId) {
    if (!sessionId) return null
    try {
      const store = ctx.get('sessions')
      const session = store?.get?.(sessionId)
      const cwd = session?.header?.cwd ?? session?.cwd
      if (typeof cwd === 'string' && cwd) return cwd
    } catch {
      // A missing session store only costs the fast path.
    }
    try {
      const query = ctx.get('sessionQuery')
      const snapshot = await query?.readSession?.(sessionId)
      const cwd = snapshot?.header?.cwd
      if (typeof cwd === 'string' && cwd) return cwd
    } catch {
      // Unreadable history falls through to "no project scope".
    }
    return null
  }

  /**
   * Synchronous working directory for prompt assembly, which cannot await.
   * @param {string} sessionId
   */
  function cwdOfSync(sessionId) {
    if (!sessionId) return null
    try {
      const store = ctx.get('sessions')
      const session = store?.get?.(sessionId)
      const cwd = session?.header?.cwd ?? session?.cwd
      return typeof cwd === 'string' && cwd ? cwd : null
    } catch {
      return null
    }
  }

  /**
   * The directory that identifies a project: the git top level when the session
   * sits inside a repository, otherwise the session's own directory. MiMoCode
   * keys projects by their worktree root, so this keeps both tools aligned.
   * @param {string} cwd
   */
  function projectAnchor(cwd) {
    const cached = anchors.get(cwd)
    if (cached !== undefined) return cached
    let anchor = resolve(cwd)
    try {
      const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
      if (top.status === 0 && top.stdout.trim()) anchor = resolve(cwd, top.stdout.trim())
    } catch {
      // Not a repository, or git is unavailable: the directory is the anchor.
    }
    anchors.set(cwd, anchor)
    return anchor
  }

  /** @param {string} key */
  async function readMeta(key) {
    try {
      return JSON.parse(await readFile(join(root, 'projects', key, 'project.json'), 'utf8'))
    } catch {
      return null
    }
  }

  /** @param {string} key @param {Record<string, unknown>} patch */
  async function updateMeta(key, patch) {
    const meta = (await readMeta(key)) ?? {}
    const next = { ...meta, ...patch, updatedAt: Date.now() }
    await writeAtomic(join(root, 'projects', key, 'project.json'), `${JSON.stringify(next, null, 2)}\n`)
    return next
  }

  /**
   * Resolve (and remember) the project scope of a session.
   * @param {string} sessionId
   * @returns {Promise<{ key: string, path: string, name: string } | null>}
   */
  async function projectOf(sessionId) {
    if (!sessionId) return null
    const cached = projects.get(sessionId)
    if (cached !== undefined) return cached
    const cwd = await cwdOf(sessionId)
    if (!cwd) {
      projects.set(sessionId, null)
      return null
    }
    const anchor = projectAnchor(cwd)
    const key = projectKey(anchor)
    const project = { key, path: anchor, name: basename(anchor) }
    projects.set(sessionId, project)

    const metaPath = join(root, 'projects', key, 'project.json')
    let exists = true
    try {
      await stat(metaPath)
    } catch {
      exists = false
    }
    if (!exists) {
      await writeAtomic(metaPath, `${JSON.stringify({ path: anchor, name: basename(anchor), updatedAt: Date.now() }, null, 2)}\n`)
    }

    // Optional one-time pickup of an existing MiMoCode project on first open.
    try {
      const meta = await readMeta(key)
      if (!meta?.mimo?.importedAt && readSettings().autoImportMimoCode) {
        const detection = await detectMimoForPath(cwd)
        if (detection.available) {
          const report = await importMimo(project, detection, {})
          if (report.imported.length > 0) {
            await updateMeta(key, { mimo: { projectId: detection.projectId, importedAt: new Date().toISOString() } })
          }
        }
      }
    } catch {
      // Import is best-effort; never block project resolution.
    }
    return project
  }

  // -------------------------------------------------------------- MiMoCode

  /** MiMoCode's data directory, honouring its own environment overrides. */
  function mimoDataDir() {
    const override = process.env.MIMOCODE_HOME
    if (override && override.startsWith('/')) return join(override, 'data')
    const xdg = process.env.XDG_DATA_HOME
    const base = xdg && xdg.startsWith('/') ? xdg : join(homedir(), '.local', 'share')
    return join(base, 'mimocode')
  }

  /**
   * Read the MiMoCode project id exactly the way MiMoCode resolves it: a UUID
   * beside the git common dir, or `.mimocode-project-id` in a non-git project.
   * @param {string} cwd
   */
  function mimoProjectId(cwd) {
    let dir = resolve(cwd)
    for (let depth = 0; depth < 12; depth += 1) {
      const gitPath = join(dir, '.git')
      let entry = null
      try {
        entry = statSync(gitPath)
      } catch {
        entry = null
      }
      if (entry) {
        if (entry.isDirectory()) return readTrimmed(join(gitPath, 'mimocode-project-id'))
        const common = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' })
        if (common.status === 0 && common.stdout.trim()) {
          return readTrimmed(join(resolve(cwd, common.stdout.trim()), 'mimocode-project-id'))
        }
        return null
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return readTrimmed(join(cwd, '.mimocode-project-id'))
  }

  /**
   * Does an existing MiMoCode install have memory for this project?
   * @param {string} cwd
   */
  async function detectMimoForPath(cwd) {
    const id = mimoProjectId(cwd)
    if (!id) return { available: false }
    const memoryRoot = join(mimoDataDir(), 'memory')
    const projectFile = join(memoryRoot, 'projects', id, 'MEMORY.md')
    const globalFile = join(memoryRoot, 'global', 'MEMORY.md')
    let bytes = 0
    let hasProject = false
    let hasGlobal = false
    try {
      const info = await stat(projectFile)
      hasProject = info.isFile()
      bytes = info.size
    } catch {
      hasProject = false
    }
    try {
      hasGlobal = (await stat(globalFile)).isFile()
    } catch {
      hasGlobal = false
    }
    return {
      available: hasProject || hasGlobal,
      projectId: id,
      hasProject,
      hasGlobal,
      bytes,
    }
  }

  /**
   * Cached detection for one project descriptor, stamped with import state.
   * @param {{ key: string, path: string } | null} project
   */
  async function detectMimo(project) {
    if (!project) return { available: false }
    const cached = mimoDetections.get(project.key)
    const now = Date.now()
    let detection
    if (cached && now - cached.at < 30_000) {
      detection = cached.value
    } else {
      detection = await detectMimoForPath(project.path)
      mimoDetections.set(project.key, { at: now, value: detection })
    }
    if (!detection.available) return detection
    const meta = await readMeta(project.key)
    return { ...detection, importedAt: meta?.mimo?.importedAt ?? null }
  }

  /** @param {string} abs */
  async function exists(abs) {
    try {
      await stat(abs)
      return true
    } catch {
      return false
    }
  }

  /** Per-path MiMoCode detection, cached briefly: git probes are not free. */
  const pathDetections = new Map()

  /** @param {string} path */
  async function detectPathCached(path) {
    const cached = pathDetections.get(path)
    if (cached && Date.now() - cached.at < 30_000) return cached.value
    const value = await detectMimoForPath(path)
    pathDetections.set(path, { at: Date.now(), value })
    return value
  }

  /**
   * One catalog for the settings page: every Harness workspace with whatever
   * MiMoCode memory it has, then MiMoCode projects no workspace covers. This is
   * what makes import reachable without opening a session anywhere.
   */
  async function listMimoProjects() {
    const memoryRoot = join(mimoDataDir(), 'memory')
    const database = join(mimoDataDir(), 'mimocode.db')

    let globalBytes = 0
    try {
      const info = await stat(join(memoryRoot, 'global', 'MEMORY.md'))
      globalBytes = info.isFile() ? info.size : 0
    } catch {
      globalBytes = 0
    }
    const global = { bytes: globalBytes, imported: await exists(join(root, 'global', 'MEMORY.md')) }

    // 1. Every Harness workspace, whether or not MiMoCode knows about it.
    const workspaces = []
    try {
      const registry = ctx.get('workspaceRegistry')
      const list = (await registry?.list?.()) ?? []
      for (const workspace of list) {
        const path = String(workspace?.path ?? '')
        if (!path) continue
        const anchor = projectAnchor(path)
        const key = projectKey(anchor)
        const detection = await detectPathCached(path)
        workspaces.push({
          kind: 'workspace',
          workspaceId: String(workspace.id ?? ''),
          title: String(workspace.title || basename(path)),
          path,
          anchor,
          projectId: detection.projectId ?? null,
          available: detection.available === true,
          bytes: detection.bytes ?? 0,
          imported: await exists(join(root, 'projects', key, 'MEMORY.md')),
        })
      }
    } catch {
      // The workspace registry is optional; the MiMoCode list still works.
    }

    // 2. MiMoCode projects that no workspace covers.
    const others = []
    let dbError
    let DatabaseSync
    try {
      ;({ DatabaseSync } = await import('node:sqlite'))
    } catch {
      DatabaseSync = undefined
      dbError = 'node:sqlite is unavailable'
    }
    if (DatabaseSync && (await exists(database))) {
      let db
      try {
        db = new DatabaseSync(database, { readOnly: true })
      } catch (error) {
        dbError = error instanceof Error ? error.message : String(error)
      }
      if (db) {
        try {
          const rows = db.prepare(
            "select id, worktree, name, time_updated from project where id <> 'global' and worktree is not null order by time_updated desc",
          ).all()
          for (const row of rows) {
            const id = String(row.id)
            const path = String(row.worktree)
            let bytes = 0
            try {
              const info = await stat(join(memoryRoot, 'projects', id, 'MEMORY.md'))
              if (!info.isFile()) continue
              bytes = info.size
            } catch {
              continue
            }
            const anchor = projectAnchor(path)
            if (workspaces.some((workspace) => workspace.anchor === anchor)) continue
            const key = projectKey(anchor)
            others.push({
              kind: 'project',
              projectId: id,
              path,
              name: row.name ? String(row.name) : basename(path),
              bytes,
              key,
              imported: await exists(join(root, 'projects', key, 'MEMORY.md')),
              updatedAt: Number(row.time_updated) || 0,
              available: true,
            })
          }
        } catch (error) {
          dbError = error instanceof Error ? error.message : String(error)
        } finally {
          try {
            db.close()
          } catch {
            // Closing a read-only handle cannot fail in a way worth reporting.
          }
        }
      }
    } else if (!dbError) {
      dbError = 'no MiMoCode database'
    }

    return {
      supported: true,
      database,
      dbError,
      workspaces,
      others,
      // Compatibility for an older client: every importable entry in one list.
      projects: [...workspaces.filter((workspace) => workspace.available), ...others],
      global,
    }
  }

  /**
   * Copy MiMoCode memory into this store. Existing destination files win
   * unless `force` is set, so a re-run never destroys local edits.
   * @param {{ key: string, path: string, name: string }} project
   * @param {Awaited<ReturnType<typeof detectMimoForPath>>} detection
   * @param {{ force?: boolean }} options
   */
  async function importMimo(project, detection, options) {
    const imported = []
    const skipped = []
    if (!detection.available) return { imported, skipped: ['no MiMoCode memory for this project'] }
    const stamp = new Date().toISOString().slice(0, 10)
    const force = options?.force === true
    const sourceRoot = join(mimoDataDir(), 'memory')

    if (detection.hasProject) {
      const dest = join(root, 'projects', project.key, 'MEMORY.md')
      let exists = true
      try {
        await stat(dest)
      } catch {
        exists = false
      }
      if (exists && !force) {
        skipped.push('project memory already exists')
      } else {
        const body = readIfExists(join(sourceRoot, 'projects', detection.projectId, 'MEMORY.md')) ?? ''
        if (body.trim()) {
          const header = `# Project memory — ${project.name}\n\n> Imported from MiMoCode project \`${detection.projectId}\` on ${stamp}.\n\n`
          await writeAtomic(dest, `${header}${stripLeadingTitle(body)}\n`)
          docs.delete(dest)
          imported.push({ path: toRel(dest), bytes: Buffer.byteLength(body) })
        }
      }
    }

    if (detection.hasGlobal) {
      const dest = join(root, 'global', 'MEMORY.md')
      let exists = true
      try {
        await stat(dest)
      } catch {
        exists = false
      }
      if (exists && !force) {
        skipped.push('global memory already exists')
      } else {
        const body = readIfExists(join(sourceRoot, 'global', 'MEMORY.md')) ?? ''
        if (body.trim()) {
          const header = `# Global memory\n\n> Imported from MiMoCode on ${stamp}.\n\n`
          await writeAtomic(dest, `${header}${stripLeadingTitle(body)}\n`)
          docs.delete(dest)
          imported.push({ path: toRel(dest), bytes: Buffer.byteLength(body) })
        }
      }
    }

    return {
      imported,
      skipped,
      projectId: detection.projectId,
      importedAt: imported.length ? new Date().toISOString() : null,
    }
  }

  // -------------------------------------------------------------- indexing

  /**
   * Walk one scope directory for Markdown files, bounded by depth and count.
   * @param {string} dir
   * @returns {Promise<string[]>}
   */
  async function walk(dir) {
    const out = []
    async function visit(current, depth) {
      if (depth > MAX_DEPTH || out.length >= MAX_FILES) return
      let entries
      try {
        entries = await readdir(current, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (out.length >= MAX_FILES) return
        if (entry.name.startsWith('.')) continue
        const abs = join(current, entry.name)
        if (entry.isDirectory()) {
          await visit(abs, depth + 1)
        } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          out.push(abs)
        }
      }
    }
    await visit(dir, 0)
    return out
  }

  /**
   * Load (or reuse) indexed documents for the requested scopes.
   * @param {{ scope?: string, sessionId?: string }} filter
   */
  async function collect(filter) {
    const dirs = []
    const scope = filter.scope ?? 'all'
    if (scope === 'all' || scope === 'global') dirs.push(join(root, 'global'))
    if (scope === 'all' || scope === 'project') {
      const project = await projectOf(filter.sessionId ?? '')
      if (project) dirs.push(join(root, 'projects', project.key))
    }
    if (scope === 'all' || scope === 'session') {
      if (filter.sessionId) dirs.push(join(root, 'sessions', filter.sessionId))
    }

    const list = []
    for (const dir of dirs) {
      for (const abs of await walk(dir)) {
        let info
        try {
          info = await stat(abs)
        } catch {
          continue
        }
        if (!info.isFile() || info.size > MAX_FILE_BYTES) continue
        let doc = docs.get(abs)
        if (!doc || doc.mtimeMs !== info.mtimeMs || doc.size !== info.size) {
          let body
          try {
            body = (await readFile(abs, 'utf8')).slice(0, MAX_INDEXED_BYTES)
          } catch {
            continue
          }
          const tokens = tokenize(body)
          const termFrequency = new Map()
          for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1)
          const rel = toRel(abs)
          doc = {
            abs,
            rel,
            body,
            mtimeMs: info.mtimeMs,
            size: info.size,
            scope: scopeOf(rel),
            type: typeOf(rel),
            termFrequency,
            length: tokens.length,
          }
          docs.set(abs, doc)
        }
        list.push(doc)
      }
    }
    return list
  }

  /**
   * Rank documents with BM25, then drop low-relevance tail hits against the
   * best score (MiMoCode's relative floor).
   * @param {string} query
   * @param {Awaited<ReturnType<typeof collect>>} list
   * @param {number} limit
   */
  function rank(query, list, limit) {
    const terms = [...new Set(tokenize(query))]
    if (terms.length === 0 || list.length === 0) return []
    const total = list.length
    const averageLength = list.reduce((sum, doc) => sum + doc.length, 0) / total || 1
    const documentFrequency = new Map()
    for (const term of terms) {
      let count = 0
      for (const doc of list) if (doc.termFrequency.has(term)) count += 1
      documentFrequency.set(term, count)
    }

    const hits = []
    for (const doc of list) {
      let score = 0
      for (const term of terms) {
        const frequency = doc.termFrequency.get(term) ?? 0
        if (frequency === 0) continue
        const df = documentFrequency.get(term) ?? 0
        const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5))
        score += (idf * (frequency * (K1 + 1))) / (frequency + K1 * (1 - B + (B * doc.length) / averageLength))
      }
      if (score > 0) hits.push({ doc, score })
    }
    hits.sort((a, b) => b.score - a.score)
    if (hits.length === 0) return []
    const cutoff = hits[0].score * SCORE_FLOOR
    return hits
      .filter((hit, index) => index === 0 || hit.score >= cutoff)
      .slice(0, limit)
      .map((hit) => ({
        path: hit.doc.rel,
        name: basename(hit.doc.rel),
        scope: hit.doc.scope,
        type: hit.doc.type,
        mtime: hit.doc.mtimeMs,
        score: Number(hit.score.toFixed(3)),
        snippet: excerpt(hit.doc.body, terms),
      }))
  }

  /**
   * A short window around the first query-term occurrence.
   * @param {string} body
   * @param {string[]} terms
   */
  function excerpt(body, terms) {
    const lower = body.toLowerCase()
    let at = -1
    for (const term of terms) {
      const index = lower.indexOf(term)
      if (index >= 0 && (at < 0 || index < at)) at = index
    }
    if (at < 0) at = 0
    const start = Math.max(0, at - 90)
    const end = Math.min(body.length, at + 170)
    const text = body.slice(start, end).replace(/\s+/g, ' ').trim()
    return `${start > 0 ? '…' : ''}${text}${end < body.length ? '…' : ''}`
  }

  /** @param {string} dir */
  async function scopeFiles(dir) {
    const files = []
    for (const abs of await walk(dir)) {
      let info
      try {
        info = await stat(abs)
      } catch {
        continue
      }
      if (!info.isFile()) continue
      const rel = toRel(abs)
      files.push({
        path: rel,
        name: basename(rel),
        type: typeOf(rel),
        bytes: info.size,
        mtime: info.mtimeMs,
      })
    }
    files.sort((a, b) => {
      const rankA = a.type === 'memory' ? 0 : a.type === 'checkpoint' ? 1 : 2
      const rankB = b.type === 'memory' ? 0 : b.type === 'checkpoint' ? 1 : 2
      return rankA - rankB || a.path.localeCompare(b.path)
    })
    return files
  }

  /**
   * Build the tree the tab renders.
   * @param {string} sessionId
   */
  async function tree(sessionId) {
    const project = await projectOf(sessionId)
    const scopes = []
    if (project) {
      scopes.push({
        id: 'project',
        detail: project.path,
        project,
        files: await scopeFiles(join(root, 'projects', project.key)),
      })
    }
    if (sessionId) {
      scopes.push({ id: 'session', detail: sessionId, files: await scopeFiles(join(root, 'sessions', sessionId)) })
    }
    scopes.push({ id: 'global', detail: '', files: await scopeFiles(join(root, 'global')) })

    let mimo = { available: false }
    try {
      mimo = await detectMimo(project)
    } catch {
      mimo = { available: false }
    }

    return {
      root,
      generatedAt: Date.now(),
      settings: readSettings(),
      mimo,
      scopes,
      empty: scopes.every((scope) => scope.files.length === 0),
    }
  }

  /** @param {string} rel */
  async function readDocument(rel) {
    const safe = safeRelative(rel)
    if (!safe) throw Object.assign(new Error('invalid memory path'), { status: 400 })
    const abs = absOf(safe)
    if (!abs) throw Object.assign(new Error('invalid memory path'), { status: 400 })
    let info
    try {
      info = await stat(abs)
    } catch {
      throw Object.assign(new Error('memory file not found'), { status: 404 })
    }
    if (!info.isFile()) throw Object.assign(new Error('memory file not found'), { status: 404 })
    const body = await readFile(abs, 'utf8')
    return {
      path: safe,
      name: basename(safe),
      scope: scopeOf(safe),
      type: typeOf(safe),
      bytes: info.size,
      mtime: info.mtimeMs,
      body,
    }
  }

  /**
   * Append to (or replace) one memory file.
   * @param {{ scope: string, file?: string, content: string, mode?: string, sessionId?: string }} input
   */
  async function writeMemory(input) {
    const scope = input.scope
    if (!['global', 'project', 'session'].includes(scope)) {
      throw Object.assign(new Error('scope must be global, project, or session'), { status: 400 })
    }
    const content = String(input.content ?? '')
    if (!content.trim()) throw Object.assign(new Error('content is empty'), { status: 400 })
    const mode = input.mode === 'replace' ? 'replace' : 'append'
    const file = input.file ?? (scope === 'session' ? 'notes.md' : 'MEMORY.md')

    let dir
    let title
    if (scope === 'global') {
      dir = join(root, 'global')
      title = 'Global memory'
    } else if (scope === 'project') {
      const project = await projectOf(input.sessionId ?? '')
      if (!project) throw Object.assign(new Error('no project scope: the session has no working directory'), { status: 409 })
      dir = join(root, 'projects', project.key)
      title = `Project memory — ${project.name}`
    } else {
      if (!input.sessionId) throw Object.assign(new Error('no session scope'), { status: 409 })
      dir = join(root, 'sessions', input.sessionId)
      title = 'Session notes'
    }

    const rel = safeRelative(file)
    if (!rel) throw Object.assign(new Error('invalid memory file name'), { status: 400 })
    const abs = absOf(join(relative(root, dir), rel))
    if (!abs) throw Object.assign(new Error('invalid memory file name'), { status: 400 })

    let current = ''
    try {
      current = await readFile(abs, 'utf8')
    } catch {
      current = ''
    }

    let next
    if (mode === 'replace') {
      next = content.endsWith('\n') ? content : `${content}\n`
    } else {
      const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
      const prefix = current.trim() ? '' : `# ${title}\n`
      next = `${current.trimEnd()}${current.trim() ? '\n\n' : prefix + '\n'}## ${stamp}\n\n${content.trimEnd()}\n`
    }
    await writeAtomic(abs, next)
    docs.delete(abs)
    return { path: toRel(abs), bytes: Buffer.byteLength(next) }
  }

  // ----------------------------------------------------------- prompt block

  /**
   * Render the model-facing memory section for one session.
   * @param {string} sessionId
   * @param {ReturnType<typeof readSettings>} settings
   */
  function memoryBlock(sessionId, settings) {
    if (!settings.enabled) return ''
    const cwd = cwdOfSync(sessionId)
    const key = cwd ? projectKey(projectAnchor(cwd)) : null

    const chunks = []
    let used = 0
    const budget = settings.maxChars
    const add = (title, body) => {
      if (!body || !body.trim()) return
      const remaining = budget - used
      if (remaining <= 0) return
      const text = body.length > remaining ? `${body.slice(0, Math.max(0, remaining - 80))}\n\n[truncated at ${budget} characters — read the file for the rest]` : body
      used += text.length
      chunks.push({ title, text })
    }

    if (settings.showHint) {
      const hint = [
        'Persistent memory is plain Markdown under `~/.dsh/memory`; the Memory tab beside Chat shows it.',
        '- Recall with `memory_search` before asking the user to repeat something.',
        '- Record durable rules, decisions, and project facts with `memory_write` (project scope); keep transient task state and secrets out.',
        '- Entries describe a point in time: verify specific paths and names before relying on them.',
      ].join('\n')
      chunks.push({ title: null, text: hint })
      used += hint.length
    }

    if (settings.injectProject && key) {
      add('Project memory', readIfExists(join(root, 'projects', key, 'MEMORY.md')))
    }
    if (settings.injectGlobal) {
      add('Global memory', readIfExists(join(root, 'global', 'MEMORY.md')))
    }
    if (settings.injectSessionNotes && sessionId) {
      add('Session notes', readIfExists(join(root, 'sessions', sessionId, 'notes.md')))
    }

    if (chunks.length === 0) return ''
    const lines = ['# Memory', '']
    for (const chunk of chunks) {
      if (chunk.title) {
        lines.push(`## ${chunk.title}`, '', chunk.text.trimEnd(), '')
      } else {
        lines.push(chunk.text, '')
      }
    }
    if (chunks.length === 1 && !chunks[0].title) {
      lines.push('No project memory recorded yet.')
    }
    return lines.join('\n').trimEnd()
  }

  // ----------------------------------------------------------------- routes

  /** @param {unknown} value @param {number} status */
  function json(value, status = 200) {
    return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
  }

  /** @param {unknown} error */
  function routeFailure(error) {
    const status = typeof error?.status === 'number' ? error.status : 500
    const message = error instanceof Error ? error.message : String(error)
    return json({ error: message }, status)
  }

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/memory.tree',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const url = new URL(request.url, 'http://localhost')
          try {
            return json(await tree(url.searchParams.get('session') ?? ''))
          } catch (error) {
            return routeFailure(error)
          }
        },
      }),
    'memory-tab: tree route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/memory.file',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const url = new URL(request.url, 'http://localhost')
          try {
            return json(await readDocument(url.searchParams.get('path') ?? ''))
          } catch (error) {
            return routeFailure(error)
          }
        },
      }),
    'memory-tab: file route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/memory.search',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const url = new URL(request.url, 'http://localhost')
          const query = url.searchParams.get('q') ?? ''
          const scope = url.searchParams.get('scope') ?? 'all'
          const sessionId = url.searchParams.get('session') ?? ''
          const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 8) || 8, 1), 30)
          try {
            const list = await collect({ scope: ['all', 'project', 'session', 'global'].includes(scope) ? scope : 'all', sessionId })
            return json({ query, results: rank(query, list, limit), scanned: list.length })
          } catch (error) {
            return routeFailure(error)
          }
        },
      }),
    'memory-tab: search route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/memory.settings',
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          if (request.method === 'GET') {
            return json({ settings: readSettings(), defaults: DEFAULT_SETTINGS })
          }
          let body
          try {
            body = await request.json()
          } catch {
            return json({ error: 'invalid-json' }, 400)
          }
          try {
            const settings = await writeSettings(body)
            return json({ settings })
          } catch (error) {
            return routeFailure(error)
          }
        },
      }),
    'memory-tab: settings route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/memory.mimo',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          try {
            return json(await listMimoProjects())
          } catch (error) {
            return routeFailure(error)
          }
        },
      }),
    'memory-tab: mimocode catalog route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/memory.import',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let body
          try {
            body = await request.json()
          } catch {
            return json({ error: 'invalid-json' }, 400)
          }
          try {
            // A) An explicit MiMoCode project, addressed without a session.
            if (typeof body?.projectId === 'string' && typeof body?.path === 'string') {
              const path = resolve(body.path)
              const project = { key: projectKey(path), path, name: basename(path) }
              const source = join(mimoDataDir(), 'memory', 'projects', body.projectId, 'MEMORY.md')
              let hasProject = false
              let bytes = 0
              try {
                const info = await stat(source)
                hasProject = info.isFile()
                bytes = info.size
              } catch {
                hasProject = false
              }
              if (!hasProject) return json({ error: 'no MiMoCode memory for that project' }, 404)
              const detection = { available: true, projectId: body.projectId, hasProject: true, hasGlobal: false, bytes }
              const report = await importMimo(project, detection, { force: body?.force === true })
              if (report.imported.length > 0) {
                mimoDetections.delete(project.key)
                await updateMeta(project.key, {
                  path,
                  name: basename(path),
                  mimo: { projectId: body.projectId, importedAt: report.importedAt },
                })
              }
              return json(report)
            }

            // B) MiMoCode global memory only.
            if (body?.global === true) {
              const source = join(mimoDataDir(), 'memory', 'global', 'MEMORY.md')
              let hasGlobal = false
              try {
                hasGlobal = (await stat(source)).isFile()
              } catch {
                hasGlobal = false
              }
              if (!hasGlobal) return json({ error: 'no MiMoCode global memory' }, 404)
              const detection = { available: true, projectId: 'global', hasProject: false, hasGlobal: true, bytes: 0 }
              const report = await importMimo({ key: '', path: '', name: '' }, detection, { force: body?.force === true })
              return json(report)
            }

            // C) The current session's project, from the tab banner.
            const project = await projectOf(String(body?.session ?? ''))
            if (!project) return json({ error: 'no project scope for this session' }, 409)
            const detection = await detectMimoForPath(project.path)
            const report = await importMimo(project, detection, { force: body?.force === true })
            if (report.imported.length > 0) {
              mimoDetections.delete(project.key)
              await updateMeta(project.key, {
                mimo: { projectId: report.projectId, importedAt: report.importedAt },
              })
            }
            return json(report)
          } catch (error) {
            return routeFailure(error)
          }
        },
      }),
    'memory-tab: import route',
  )

  // ------------------------------------------------------------ prompt seat

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'memory',
        order: PROMPT_SECTION_ORDER,
        text: (assembly) => {
          try {
            const sessionId = String(assembly?.agent?.id ?? assembly?.scope?.id ?? '')
            return memoryBlock(sessionId, readSettings())
          } catch {
            return ''
          }
        },
      }),
    'memory-tab: prompt section',
  )

  // ------------------------------------------------------------------ tools

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'memory_search',
        description: [
          'Search the Harness persistent memory and return BM25-ranked snippets with file paths.',
          'Memory is plain Markdown: project MEMORY.md (rules, architecture decisions, durable project facts),',
          'session notes.md (scratchpad, unresolved questions), and global MEMORY.md (user preferences).',
          'Use it before asking the user to repeat something, and before re-deriving a past decision.',
          'Queries are OR-joined and ranked, so 1-3 distinctive terms beat a long description.',
          'Read the returned path with the read tool when the snippet is not enough.',
        ].join(' '),
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string', description: 'Search words. Punctuation is ignored; rare terms rank best.' },
            scope: {
              type: 'string',
              enum: ['all', 'project', 'session', 'global'],
              description: 'Restrict the search to one memory scope. Default: all.',
            },
            limit: { type: 'integer', description: 'Maximum results (default from Settings → Memory, max 30).' },
          },
          required: ['query'],
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: { text: { type: 'string' } },
            required: ['text'],
          },
          render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
        },
        execute: async (args, exec) => {
          const settings = readSettings()
          if (!settings.enabled) {
            return { text: 'Memory is turned off in Settings → Memory, so nothing is stored or searched. Ask the user to enable it there.' }
          }
          const query = String(args?.query ?? '').trim()
          if (!query) throw new Error('query is required')
          const scope = ['all', 'project', 'session', 'global'].includes(args?.scope) ? args.scope : 'all'
          const limit = Math.min(Math.max(Number(args?.limit ?? settings.searchLimit) || settings.searchLimit, 1), 30)
          const sessionId = String(exec?.agent?.id ?? '')
          const list = await collect({ scope, sessionId })
          const results = rank(query, list, limit)
          if (results.length === 0) {
            return {
              text: `No memory matches for "${query}" (${list.length} file${list.length === 1 ? '' : 's'} scanned).\nMemory root: ${root}\nRetry with fewer, more distinctive terms, or widen the scope.`,
            }
          }
          const lines = [
            `${results.length} memory match${results.length === 1 ? '' : 'es'} (BM25, best first):`,
            '',
          ]
          for (const result of results) {
            lines.push(`### ${result.path}  [${result.scope}/${result.type}]  score ${result.score}`)
            lines.push(result.snippet)
            lines.push('')
          }
          lines.push('Snippets are truncated: read a path for the full body.')
          return { text: lines.join('\n') }
        },
      }),
    'memory-tab: memory_search tool',
  )

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'memory_write',
        description: [
          'Record something durable in the Harness persistent memory.',
          'Use project scope for rules, architecture decisions, and facts that should outlive this session;',
          'global scope for user preferences that apply to every project; session scope for scratch notes.',
          'Append mode adds a dated entry; replace mode overwrites the file.',
          'Do not record secrets, credentials, or transient task state.',
        ].join(' '),
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            scope: {
              type: 'string',
              enum: ['project', 'session', 'global'],
              description: 'Which memory scope to write.',
            },
            content: { type: 'string', description: 'Markdown entry to record.' },
            mode: {
              type: 'string',
              enum: ['append', 'replace'],
              description: 'Append a dated entry (default) or replace the whole file.',
            },
            file: {
              type: 'string',
              description: 'File inside the scope. Defaults: MEMORY.md for project/global, notes.md for session.',
            },
          },
          required: ['scope', 'content'],
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: { text: { type: 'string' } },
            required: ['text'],
          },
          render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
        },
        execute: async (args, exec) => {
          const settings = readSettings()
          if (!settings.enabled) {
            return { text: 'Memory is turned off in Settings → Memory; nothing was written. Ask the user to enable it there.' }
          }
          const written = await writeMemory({
            scope: String(args?.scope ?? ''),
            content: String(args?.content ?? ''),
            mode: args?.mode,
            file: args?.file,
            sessionId: String(exec?.agent?.id ?? ''),
          })
          return { text: `Recorded in memory: ${written.path} (${written.bytes} bytes).` }
        },
      }),
    'memory-tab: memory_write tool',
  )
}

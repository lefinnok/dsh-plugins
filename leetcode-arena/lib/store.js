/**
 * Durable arena state.
 *
 * Markdown is not the source of truth here: practice state (code drafts,
 * attempts, coach threads) belongs to the arena, not to the session log. The
 * file is a small JSON document under `$DSH_HOME/leetcode-arena`, written
 * atomically and debounced so typing in the editor does not hammer the disk.
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const VERSION = 1
const SAVE_DELAY_MS = 500
const MAX_HISTORY = 30
const MAX_COACH_MESSAGES = 40
const MAX_COACH_TESTS = 16
const CATALOG_TTL_MS = 60 * 60 * 1000
const PROBLEM_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function arenaHome() {
  const base = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(base, 'leetcode-arena')
}

export function emptyProblem() {
  return {
    status: 'unsolved',
    solved: false,
    attempts: 0,
    submits: 0,
    runs: 0,
    solvedAt: null,
    firstSeenAt: null,
    lastRunAt: null,
    maxHintLevel: 0,
    solvedLevel: null,
    clean: false,
    code: {},
    last: null,
    history: [],
    coach: [],
    coachTests: [],
  }
}

function emptyState() {
  return {
    version: VERSION,
    createdAt: Date.now(),
    updatedAt: 0,
    settings: { defaultLanguage: 'python', level: 0 },
    problems: {},
    imported: {},
    catalog: {},
  }
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeState(raw) {
  const base = emptyState()
  if (!plainObject(raw)) return base
  const state = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(plainObject(raw.settings) ? raw.settings : {}) },
    problems: plainObject(raw.problems) ? raw.problems : {},
    imported: plainObject(raw.imported) ? raw.imported : {},
    catalog: plainObject(raw.catalog) ? raw.catalog : {},
  }
  state.version = VERSION
  for (const [slug, record] of Object.entries(state.problems)) {
    if (!plainObject(record)) {
      state.problems[slug] = emptyProblem()
      continue
    }
    const merged = { ...emptyProblem(), ...record }
    if (!plainObject(merged.code)) merged.code = {}
    if (!Array.isArray(merged.history)) merged.history = []
    else merged.history = merged.history.slice(0, MAX_HISTORY)
    if (!Array.isArray(merged.coach)) merged.coach = []
    else merged.coach = merged.coach.slice(-MAX_COACH_MESSAGES)
    if (!Array.isArray(merged.coachTests)) merged.coachTests = []
    else merged.coachTests = merged.coachTests.slice(-MAX_COACH_TESTS)
    state.problems[slug] = merged
  }
  return state
}

export class ArenaStore {
  constructor() {
    this.home = arenaHome()
    this.statePath = join(this.home, 'state.json')
    this.cacheDir = join(this.home, 'cache')
    this.problemCacheDir = join(this.cacheDir, 'problems')
    this.tmpRoot = join(this.home, 'tmp')
    this.state = null
    this.dirty = false
    this.timer = null
    this.writing = Promise.resolve()
    this.loading = null
  }

  async load() {
    if (this.state) return this.state
    if (this.loading) return this.loading
    this.loading = (async () => {
      await mkdir(this.home, { recursive: true })
      await mkdir(this.problemCacheDir, { recursive: true })
      await mkdir(this.tmpRoot, { recursive: true })
      try {
        const text = await readFile(this.statePath, 'utf8')
        this.state = normalizeState(JSON.parse(text))
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          // Keep the unreadable file for inspection instead of overwriting it.
          try {
            await rename(this.statePath, `${this.statePath}.corrupt-${Date.now()}`)
          } catch {
            /* ignore */
          }
        }
        this.state = emptyState()
      }
      return this.state
    })()
    return this.loading
  }

  get() {
    return this.state ?? emptyState()
  }

  problem(slug) {
    const state = this.get()
    if (!plainObject(state.problems[slug])) state.problems[slug] = emptyProblem()
    return state.problems[slug]
  }

  update(mutate) {
    const state = this.get()
    mutate(state)
    state.updatedAt = Date.now()
    this.dirty = true
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null
        void this.flush()
      }, SAVE_DELAY_MS)
      this.timer.unref?.()
    }
    return state
  }

  async flush() {
    if (!this.state) return
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.dirty) return
    this.dirty = false
    const snapshot = JSON.stringify(this.state, null, 2)
    this.writing = this.writing
      .then(async () => {
        await mkdir(dirname(this.statePath), { recursive: true })
        const tmp = `${this.statePath}.tmp`
        await writeFile(tmp, `${snapshot}\n`, 'utf8')
        await rename(tmp, this.statePath)
      })
      .catch(() => {
        this.dirty = true
      })
    await this.writing
  }

  async readProblemCache(slug) {
    try {
      const text = await readFile(join(this.problemCacheDir, `${slug}.json`), 'utf8')
      const entry = JSON.parse(text)
      if (!plainObject(entry) || !entry.problem) return null
      if (Date.now() - Number(entry.at ?? 0) > PROBLEM_TTL_MS) return null
      return entry.problem
    } catch {
      return null
    }
  }

  async writeProblemCache(slug, problem) {
    try {
      await mkdir(this.problemCacheDir, { recursive: true })
      const path = join(this.problemCacheDir, `${slug}.json`)
      const tmp = `${path}.tmp`
      await writeFile(tmp, `${JSON.stringify({ at: Date.now(), problem })}\n`, 'utf8')
      await rename(tmp, path)
    } catch {
      /* a cache write failure must not fail the import */
    }
  }

  catalogEntry(key, { allowStale = false } = {}) {
    const state = this.get()
    const entry = state.catalog[key]
    if (!plainObject(entry) || !Array.isArray(entry.items)) return null
    if (!allowStale && Date.now() - Number(entry.at ?? 0) > CATALOG_TTL_MS) return null
    return entry
  }

  putCatalogEntry(key, payload) {
    this.update((state) => {
      state.catalog[key] = { at: Date.now(), ...payload }
      const keys = Object.keys(state.catalog)
      if (keys.length > 12) {
        keys
          .sort((a, b) => Number(state.catalog[a]?.at ?? 0) - Number(state.catalog[b]?.at ?? 0))
          .slice(0, keys.length - 12)
          .forEach((old) => delete state.catalog[old])
      }
    })
  }

  async importedSummary() {
    const state = this.get()
    const items = []
    for (const [slug, entry] of Object.entries(state.imported)) {
      items.push({ slug, ...entry })
    }
    return items
  }

  /** Remove old temp run directories left behind by a crash. */
  async cleanTmp(maxAgeMs = 6 * 60 * 60 * 1000) {
    try {
      const { readdir, rm } = await import('node:fs/promises')
      const entries = await readdir(this.tmpRoot, { withFileTypes: true })
      const now = Date.now()
      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const path = join(this.tmpRoot, entry.name)
            try {
              const info = await stat(path)
              if (now - info.mtimeMs > maxAgeMs) await rm(path, { recursive: true, force: true })
            } catch {
              /* ignore */
            }
          }),
      )
    } catch {
      /* ignore */
    }
  }
}

/**
 * Host half of the Git panel (`@local/dsh-git`).
 *
 * Answers one question the model and the user both need answered: what is the
 * Git state of the directory this Session is actually working in? The answer is
 * derived on demand from `git` itself — branch, HEAD, upstream divergence,
 * linked-worktree identity, and the staged/unstaged/untracked/conflicted split —
 * and served to the browser half over an authenticated Connection Fetch route.
 *
 * Nothing is persisted and nothing is polled here: each request runs a fresh
 * `git status --porcelain=v2` against the Session's committed directory, so the
 * panel can never show a cached answer that the working tree has moved past.
 *
 * @module @local/dsh-git
 */

/** The plugin needs the authenticated route registry and Git's execution world. */
export const inject = ['connection', 'sessions', 'subprocess', 'workingDirectory']

/** Authenticated routes the browser half calls. */
const STATUS_PATH = '/api/git.status'
const INIT_PATH = '/api/git.init'

/** Bound on captured output, and on files echoed back to the browser. */
const MAX_STDOUT = 1024 * 1024
const MAX_STDERR = 64 * 1024
const MAX_FILES = 100

/** Environment that keeps a status probe read-only and non-interactive. */
function gitEnvironment() {
  return {
    ...process.env,
    // Never take the index lock for a read, never prompt, never localize output.
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    LC_ALL: 'C',
  }
}

/** Read a collect-mode stream without consuming it for anyone else. */
function readFrom(reader) {
  if (reader === undefined) return ''
  try {
    const read = reader.readFrom(0)
    return typeof read.text === 'string' ? read.text : ''
  } catch {
    return ''
  }
}

/**
 * Run one Git command in `cwd`.
 * @returns exit facts plus captured output; never throws for a failed command.
 */
async function runGit(ctx, cwd, args) {
  let executable
  try {
    executable = await ctx.subprocess.resolveExecutable('git')
  } catch (error) {
    return { ok: false, code: 'git-missing', message: String(error?.message ?? error), stdout: '', stderr: '' }
  }

  let handle
  try {
    handle = ctx.subprocess.spawn({
      argv: [executable, ...args],
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: MAX_STDOUT },
        stderr: { maxBytes: MAX_STDERR },
      },
      graceMs: 4000,
      env: gitEnvironment(),
    })
  } catch (error) {
    return { ok: false, code: 'spawn-failed', message: String(error?.message ?? error), stdout: '', stderr: '' }
  }

  let outcome
  try {
    outcome = await handle.done
  } catch (error) {
    return { ok: false, code: 'spawn-failed', message: String(error?.message ?? error), stdout: '', stderr: '' }
  }

  const stdout = readFrom(handle.collected.stdout)
  const stderr = readFrom(handle.collected.stderr)
  return {
    ok: outcome.exitCode === 0,
    code: outcome.exitCode === 0 ? 'ok' : 'exit',
    exitCode: outcome.exitCode,
    message: stderr.trim() || stdout.trim(),
    stdout,
    stderr,
  }
}

/** The Session's effective directory, falling back to its recorded header. */
function directoryOf(ctx, session) {
  try {
    return ctx.workingDirectory.get(session)
  } catch {
    return session.header?.cwd ?? ctx.workingDirectory.defaultDirectory
  }
}

/** One porcelain-v2 status record, reduced to what the panel renders. */
function pushFile(state, entry) {
  if (state.files.length >= MAX_FILES) {
    state.truncated = true
    return
  }
  state.files.push(entry)
}

/** Attribute one porcelain-v2 XY pair to the index and/or the working tree. */
function countXY(state, xy, kind) {
  if (kind === 'conflict') {
    state.conflicted += 1
    state.total += 1
    return
  }
  let counted = false
  if (xy[0] !== '.' && xy[0] !== ' ') {
    state.staged += 1
    counted = true
  }
  if (xy[1] !== '.' && xy[1] !== ' ') {
    state.unstaged += 1
    counted = true
  }
  if (counted) state.total += 1
}

/**
 * Parse `git status --porcelain=v2 --branch --show-stash`.
 * Rename records carry the original path after a tab; it is reported separately.
 */
export function parseStatus(text) {
  const state = {
    branch: {
      name: null,
      oid: null,
      detached: false,
      initial: false,
      upstream: null,
      ahead: 0,
      behind: 0,
    },
    stash: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicted: 0,
    total: 0,
    files: [],
    truncated: false,
  }

  for (const line of String(text).split('\n')) {
    if (line === '') continue

    if (line.startsWith('# ')) {
      const [key, ...rest] = line.slice(2).split(' ')
      const value = rest.join(' ')
      if (key === 'branch.oid') {
        if (value === '(initial)') state.branch.initial = true
        else state.branch.oid = value
      } else if (key === 'branch.head') {
        if (value === '(detached)') state.branch.detached = true
        else state.branch.name = value
      } else if (key === 'branch.upstream') {
        state.branch.upstream = value
      } else if (key === 'branch.ab') {
        const match = /^\+(-?\d+)\s+-(-?\d+)$/u.exec(value)
        if (match !== null) {
          state.branch.ahead = Number(match[1])
          state.branch.behind = Number(match[2])
        }
      } else if (key === 'stash') {
        const count = Number(value)
        if (Number.isFinite(count)) state.stash = count
      }
      continue
    }

    if (line.startsWith('? ')) {
      state.untracked += 1
      state.total += 1
      pushFile(state, { path: line.slice(2), kind: 'untracked', index: '.', worktree: '?' })
      continue
    }

    if (line.startsWith('! ')) continue

    if (line.startsWith('u ')) {
      // u XY sub m1 m2 m3 mW h1 h2 h3 path
      const parts = line.split(' ')
      const xy = parts[1] ?? 'UU'
      countXY(state, xy, 'conflict')
      pushFile(state, {
        path: parts.slice(10).join(' '),
        kind: 'conflict',
        index: xy[0],
        worktree: xy[1],
      })
      continue
    }

    if (line.startsWith('1 ') || line.startsWith('2 ')) {
      // 1 XY sub mH mI mW hH hI path
      // 2 XY sub mH mI mW hH hI Xscore path<TAB>origPath
      const parts = line.split(' ')
      const xy = parts[1] ?? '..'
      const renamed = parts[0] === '2'
      const rest = parts.slice(renamed ? 9 : 8).join(' ')
      const [path, original] = renamed ? rest.split('\t') : [rest, undefined]
      countXY(state, xy, 'tracked')
      pushFile(state, {
        path,
        original,
        kind: xy[0] !== '.' ? (xy[1] !== '.' ? 'both' : 'staged') : 'unstaged',
        index: xy[0],
        worktree: xy[1],
      })
    }
  }

  return state
}

/** Repository identity, including whether this checkout is a linked worktree. */
async function repositoryOf(ctx, cwd) {
  const result = await runGit(ctx, cwd, [
    'rev-parse',
    '--path-format=absolute',
    '--show-toplevel',
    '--absolute-git-dir',
    '--git-common-dir',
  ])
  if (!result.ok || result.code !== 'ok') return undefined

  const lines = result.stdout.split('\n').filter((line) => line !== '')
  const [root, gitDir, commonDir] = lines
  if (root === undefined || gitDir === undefined) return undefined

  const name = root === '/' ? root : root.slice(root.lastIndexOf('/') + 1)
  return {
    root,
    gitDir,
    commonDir: commonDir ?? gitDir,
    name,
    worktree: commonDir !== undefined && commonDir !== gitDir,
  }
}

/** Headline commit, so the panel can say what was committed last. */
async function headOf(ctx, cwd) {
  const result = await runGit(ctx, cwd, ['log', '-1', '--format=%h%x1f%s%x1f%ct'])
  if (!result.ok) return undefined
  const [sha, subject, time] = result.stdout.trim().split('\x1f')
  if (sha === undefined || sha === '') return undefined
  return { sha, subject: subject ?? '', time: Number(time) || 0 }
}

/** A directory that exists but holds no repository is the actionable case. */
function isNoRepository(result) {
  return /not a git repository/iu.test(result.stderr) || /not a git repository/iu.test(result.stdout)
}

/**
 * Inspect one Session's directory.
 * @returns the payload the browser half renders.
 */
export async function inspect(ctx, session) {
  const cwd = directoryOf(ctx, session)

  const status = await runGit(ctx, cwd, [
    'status',
    '--porcelain=v2',
    '--branch',
    '--show-stash',
    '--untracked-files=normal',
  ])

  const base = { sessionId: session.id, cwd, git: true, repo: undefined, branch: undefined, head: undefined }

  if (status.code === 'git-missing') {
    return { ...base, git: false, state: 'git-missing', error: status.message, changes: undefined }
  }
  if (!status.ok && isNoRepository(status)) {
    return { ...base, state: 'no-repo', error: undefined, changes: undefined }
  }
  if (!status.ok) {
    return { ...base, state: 'error', error: status.message || `git status exited with ${status.exitCode}` }
  }

  const repo = await repositoryOf(ctx, cwd)
  const parsed = parseStatus(status.stdout)
  const head = parsed.branch.initial ? undefined : await headOf(ctx, cwd)

  return {
    ...base,
    repo,
    state: 'ok',
    error: undefined,
    branch: parsed.branch,
    head,
    stash: parsed.stash,
    changes: {
      staged: parsed.staged,
      unstaged: parsed.unstaged,
      untracked: parsed.untracked,
      conflicted: parsed.conflicted,
      total: parsed.total,
      files: parsed.files,
      truncated: parsed.truncated,
    },
  }
}

/** Resolve the Session named by the request, or answer 404. */
function sessionOf(ctx, request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('session')
  if (id === null || id === '') return undefined
  return ctx.sessions.get(id)
}

/** Register the status and init routes. */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: STATUS_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const session = sessionOf(ctx, request)
          if (session === undefined) return Response.json({ error: 'unknown-session' }, { status: 404 })
          try {
            return Response.json(await inspect(ctx, session), {
              headers: { 'cache-control': 'no-store' },
            })
          } catch (error) {
            return Response.json(
              { sessionId: session.id, state: 'error', error: String(error?.message ?? error) },
              { status: 200, headers: { 'cache-control': 'no-store' } },
            )
          }
        },
      }),
    'git: status route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: INIT_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const session = sessionOf(ctx, request)
          if (session === undefined) return Response.json({ error: 'unknown-session' }, { status: 404 })

          const cwd = directoryOf(ctx, session)
          const current = await runGit(ctx, cwd, ['rev-parse', '--is-inside-work-tree'])
          if (current.ok && current.stdout.trim() === 'true') {
            // Already a repository: report it instead of nesting a second one.
            return Response.json(
              { init: 'already', status: await inspect(ctx, session) },
              { headers: { 'cache-control': 'no-store' } },
            )
          }

          const result = await runGit(ctx, cwd, ['init'])
          if (!result.ok) {
            return Response.json(
              { init: 'failed', error: result.message || `git init exited with ${result.exitCode}` },
              { status: 200, headers: { 'cache-control': 'no-store' } },
            )
          }
          return Response.json(
            { init: 'created', status: await inspect(ctx, session) },
            { headers: { 'cache-control': 'no-store' } },
          )
        },
      }),
    'git: init route',
  )
}

/**
 * Host half of the LeetCode Arena (`@local/dsh-leetcode`).
 *
 * Surfaces:
 *   - an authenticated `/api/leetcode.*` surface for the Web panel;
 *   - a bounded local runner for Python, JavaScript, and C++;
 *   - a LeetCode GraphQL catalog/importer with an on-disk cache;
 *   - a tiered coach that calls the profile's default model directly and
 *     validates generated cases against curated references.
 *
 * The arena owns its practice state under `$DSH_HOME/leetcode-arena`; the agent
 * session log is intentionally untouched.
 */
import { CURATED, REFERENCES } from './data/curated.js'
import { ArenaStore, emptyProblem } from './lib/store.js'
import {
  fetchCatalog,
  fetchQuestion,
  parseQuestion,
  slugFromInput,
  LeetCodeError,
} from './lib/leetcode.js'
import { LANGUAGES, supportedLanguages } from './lib/harness.js'
import { runTests } from './lib/runner.js'
import {
  ACTIONS,
  LEVELS,
  actionAllowed,
  actionInfo,
  clampLevel,
  coachSystemPrompt,
  coachUserText,
  parseCoachTests,
  validateCoachTests,
} from './lib/coach.js'

/** The plugin needs authenticated fetch routes and the model stream. */
export const inject = ['connection', 'llm', 'agentDefaultModel']

const COACH_JOB_TTL_MS = 10 * 60 * 1000
const MAX_CODE_BYTES = 200_000
const MAX_COACH_MESSAGE = 4000
const MAX_EXTRA_TESTS = 8

const CURATED_BY_SLUG = new Map()
for (const problem of CURATED) {
  CURATED_BY_SLUG.set(problem.slug, {
    ...problem,
    reference: { python: REFERENCES[problem.slug] },
  })
}

const LANGUAGE_IDS = new Set(LANGUAGES.map((language) => language.id))

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function failure(error, status) {
  const code = typeof error?.status === 'number' && error.status >= 400 ? error.status : status
  const message = error instanceof Error ? error.message : String(error)
  return json({ error: message }, code ?? 500)
}

function bodyJson(request) {
  return request.json().catch(() => ({}))
}

function titleCase(value) {
  const text = String(value ?? '')
  return text === '' ? '' : text[0].toUpperCase() + text.slice(1).toLowerCase()
}

function publicRecord(record) {
  return {
    status: record.status ?? 'unsolved',
    solved: record.solved === true,
    attempts: Number(record.attempts) || 0,
    submits: Number(record.submits) || 0,
    runs: Number(record.runs) || 0,
    solvedAt: record.solvedAt ?? null,
    firstSeenAt: record.firstSeenAt ?? null,
    lastRunAt: record.lastRunAt ?? null,
    maxHintLevel: Number(record.maxHintLevel) || 0,
    solvedLevel: record.solvedLevel ?? null,
    clean: record.clean === true,
    level: clampLevel(record.level ?? 0),
    code: record.code ?? {},
    coach: Array.isArray(record.coach) ? record.coach : [],
    coachTests: Array.isArray(record.coachTests) ? record.coachTests : [],
    last: record.last ?? null,
    history: Array.isArray(record.history) ? record.history.slice(0, 10) : [],
  }
}

function publicProblem(problem, record) {
  const { reference, tests, ...rest } = problem
  return {
    ...rest,
    frontendId: problem.frontendId ?? problem.order ?? null,
    url: problem.url ?? `https://leetcode.com/problems/${problem.slug}/`,
    tests: {
      visible: tests?.visible ?? [],
      hidden: [],
    },
    hiddenCount: problem.hiddenCount ?? tests?.hidden?.length ?? 0,
    visibleCount: problem.visibleCount ?? tests?.visible?.length ?? 0,
    availableLanguages: supportedLanguages(problem.meta),
    runnable:
      !problem.design &&
      supportedLanguages(problem.meta).length > 0 &&
      (tests?.visible?.length ?? 0) + (tests?.hidden?.length ?? 0) > 0,
    record: publicRecord(record),
  }
}

function curatedSummary(problem, state) {
  const record = state.problems[problem.slug]
  const languages = supportedLanguages(problem.meta)
  return {
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    tags: problem.tags ?? [],
    pattern: problem.pattern ?? '',
    order: problem.order ?? 9999,
    source: 'curated',
    curated: true,
    imported: false,
    runnable: !problem.design && languages.length > 0 && (problem.hiddenCount + problem.visibleCount) > 0,
    availableLanguages: languages,
    visibleCount: problem.visibleCount,
    hiddenCount: problem.hiddenCount,
    status: record?.status ?? 'unsolved',
    solved: record?.solved === true,
    clean: record?.clean === true,
    level: clampLevel(record?.level ?? state.settings.level ?? 0),
    url: `https://leetcode.com/problems/${problem.slug}/`,
  }
}

function importedSummary(slug, entry, state) {
  const record = state.problems[slug]
  return {
    slug,
    title: entry.title ?? slug,
    difficulty: entry.difficulty ?? '',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    pattern: '',
    order: 9999,
    source: 'leetcode',
    curated: false,
    imported: true,
    runnable: entry.runnable === true,
    availableLanguages: Array.isArray(entry.availableLanguages) ? entry.availableLanguages : [],
    visibleCount: Number(entry.visibleCount) || 0,
    hiddenCount: 0,
    design: entry.design === true,
    status: record?.status ?? 'unsolved',
    solved: record?.solved === true,
    clean: record?.clean === true,
    level: clampLevel(record?.level ?? state.settings.level ?? 0),
    url: `https://leetcode.com/problems/${slug}/`,
  }
}

function localCatalog(state, scope, search, difficulty) {
  const items = []
  const push = (item) => {
    if (scope === 'curated' && !item.curated) return
    if (scope === 'imported' && !item.imported) return
    if (difficulty && item.difficulty.toLowerCase() !== difficulty.toLowerCase()) return
    if (search) {
      const haystack = `${item.title} ${item.slug} ${(item.tags ?? []).join(' ')}`.toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return
    }
    items.push(item)
  }
  for (const problem of CURATED) push(curatedSummary(problem, state))
  for (const [slug, entry] of Object.entries(state.imported)) push(importedSummary(slug, entry, state))
  items.sort((a, b) => {
    if (a.curated !== b.curated) return a.curated ? -1 : 1
    if (a.curated) return a.order - b.order
    return a.title.localeCompare(b.title)
  })
  return items.slice(0, 200)
}

function statsOf(state) {
  const curatedSlugs = new Set(CURATED.map((problem) => problem.slug))
  let curatedSolved = 0
  let curatedAttempted = 0
  let cleanSolves = 0
  let runs = 0
  let solvedToday = 0
  const today = new Date().toDateString()
  for (const [slug, record] of Object.entries(state.problems)) {
    runs += Number(record.runs) || 0
    if (!record.solved) {
      if (curatedSlugs.has(slug) && record.status === 'attempted') curatedAttempted += 1
      continue
    }
    if (curatedSlugs.has(slug)) curatedSolved += 1
    if (record.clean === true) cleanSolves += 1
    if (record.solvedAt && new Date(record.solvedAt).toDateString() === today) solvedToday += 1
  }
  return {
    curatedTotal: CURATED.length,
    curatedSolved,
    curatedAttempted,
    importedTotal: Object.keys(state.imported).length,
    cleanSolves,
    runs,
    solvedToday,
  }
}

function modelSelection(ctx) {
  try {
    const selection = ctx.agentDefaultModel.currentSelection()
    if (!selection || typeof selection.provider !== 'string' || typeof selection.model !== 'string') return null
    return { provider: selection.provider, model: selection.model }
  } catch {
    return null
  }
}

export function apply(ctx) {
  const store = new ArenaStore()
  const jobs = new Map()
  let loaded = false
  const ready = async () => {
    if (!loaded) {
      await store.load()
      loaded = true
      void store.cleanTmp()
    }
    return store.get()
  }

  const pruneJobs = () => {
    const now = Date.now()
    for (const [id, job] of jobs) {
      if (job.finishedAt && now - job.finishedAt > COACH_JOB_TTL_MS) jobs.delete(id)
    }
  }

  async function loadProblem(slug) {
    const curated = CURATED_BY_SLUG.get(slug)
    if (curated) return curated
    const cached = await store.readProblemCache(slug)
    if (cached) {
      store.update((state) => {
        const previous = state.imported[slug]
        state.imported[slug] = {
          at: previous?.at ?? Date.now(),
          title: cached.title,
          difficulty: cached.difficulty,
          tags: cached.tags,
          runnable: cached.runnable,
          availableLanguages: cached.availableLanguages,
          visibleCount: cached.visibleCount,
          design: cached.design,
        }
      })
      return cached
    }
    const raw = await fetchQuestion(slug)
    const problem = parseQuestion(raw)
    if (problem.paidOnly && !problem.statement) {
      throw new LeetCodeError('That problem is premium-only; its free statement is not available.', 404)
    }
    await store.writeProblemCache(slug, problem)
    store.update((state) => {
      state.imported[slug] = {
        at: Date.now(),
        title: problem.title,
        difficulty: problem.difficulty,
        tags: problem.tags,
        runnable: problem.runnable,
        availableLanguages: problem.availableLanguages,
        visibleCount: problem.visibleCount,
        design: problem.design,
      }
    })
    return problem
  }

  function recordFor(slug) {
    const state = store.get()
    const record = store.problem(slug)
    if (!Number.isFinite(record.level)) record.level = clampLevel(state.settings.level ?? 0)
    return record
  }

  ctx.effect(() => {
    // This lifecycle effect owns the in-flight coach jobs and the final state
    // flush; individual routes are registered by their own effects below.
    return () => {
      for (const job of jobs.values()) job.controller?.abort()
      void store.flush()
    }
  }, 'leetcode-arena: lifecycle')

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.state',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          try {
            const state = await ready()
            return json({
              version: 1,
              home: store.home,
              model: modelSelection(ctx),
              languages: LANGUAGES,
              levels: LEVELS,
              actions: ACTIONS.map(({ id, label, minLevel }) => ({ id, label, minLevel })),
              settings: state.settings,
              stats: statsOf(state),
              curated: CURATED.map((problem) => curatedSummary(problem, state)),
              imported: Object.entries(state.imported).map(([slug, entry]) => importedSummary(slug, entry, state)),
            })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: state route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.catalog',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const state = await ready()
            const url = new URL(request.url, 'http://localhost')
            const scope = url.searchParams.get('scope') === 'curated'
              ? 'curated'
              : url.searchParams.get('scope') === 'imported'
                ? 'imported'
                : 'all'
            const search = (url.searchParams.get('search') ?? '').trim()
            const difficulty = (url.searchParams.get('difficulty') ?? '').trim()
            const page = Math.max(0, Number(url.searchParams.get('page')) || 0)
            const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 50))
            const local = localCatalog(state, scope, search, difficulty)
            if (scope !== 'all') {
              return json({ items: local, total: local.length, page, limit, hasMore: false, offline: false, localOnly: true })
            }
            const key = `remote:${search.toLowerCase()}:${difficulty.toLowerCase()}:${page}:${limit}`
            let remote = store.catalogEntry(key)
            let offline = false
            let error = null
            if (!remote) {
              try {
                remote = await fetchCatalog({ search, difficulty, page, limit })
                store.putCatalogEntry(key, remote)
              } catch (caught) {
                error = caught instanceof Error ? caught.message : String(caught)
                const stale = store.catalogEntry(key, { allowStale: true })
                if (stale) {
                  remote = stale
                } else {
                  offline = true
                  remote = { total: 0, items: [] }
                }
              }
            }
            const seen = new Set(local.map((item) => item.slug))
            const remoteItems = (remote.items ?? [])
              .filter((item) => !item.paid && !seen.has(item.slug))
              .map((item) => {
                const record = state.problems[item.slug]
                return {
                  ...item,
                  source: 'leetcode',
                  curated: false,
                  imported: Boolean(state.imported[item.slug]),
                  runnable: Boolean(state.imported[item.slug]?.runnable),
                  availableLanguages: state.imported[item.slug]?.availableLanguages ?? [],
                  visibleCount: state.imported[item.slug]?.visibleCount ?? 0,
                  hiddenCount: 0,
                  status: record?.status ?? 'unsolved',
                  solved: record?.solved === true,
                  clean: record?.clean === true,
                  level: clampLevel(record?.level ?? state.settings.level ?? 0),
                }
              })
            const items = page === 0 ? [...local, ...remoteItems] : remoteItems
            return json({
              items,
              total: Number(remote.total) + local.length,
              page,
              limit,
              hasMore: page * limit + (remote.items?.length ?? 0) < Number(remote.total ?? 0),
              offline,
              error,
              localOnly: false,
            })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: catalog route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.problem',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            await ready()
            const url = new URL(request.url, 'http://localhost')
            const slug = slugFromInput(url.searchParams.get('slug') ?? '')
            if (!slug) return json({ error: 'A problem slug is required.' }, 400)
            const problem = await loadProblem(slug)
            const record = recordFor(slug)
            if (!record.firstSeenAt) {
              record.firstSeenAt = Date.now()
              void store.flush()
            }
            return json({ problem: publicProblem(problem, record) })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: problem route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.import',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            await ready()
            const body = await bodyJson(request)
            const slug = slugFromInput(body.input ?? body.slug ?? '')
            if (!slug) return json({ error: 'Paste a LeetCode URL or slug.' }, 400)
            const problem = await loadProblem(slug)
            const record = recordFor(slug)
            return json({
              summary:
                problem.source === 'curated'
                  ? curatedSummary(problem, store.get())
                  : importedSummary(slug, store.get().imported[slug] ?? {}, store.get()),
              problem: publicProblem(problem, record),
            })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: import route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.save',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            await ready()
            const body = await bodyJson(request)
            const slug = slugFromInput(body.slug ?? '')
            const language = String(body.language ?? '')
            if (!slug || !LANGUAGE_IDS.has(language)) return json({ error: 'Unknown problem or language.' }, 400)
            const code = String(body.code ?? '')
            if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
              return json({ error: 'The solution is larger than 200 KB.' }, 413)
            }
            const record = recordFor(slug)
            record.code[language] = code
            record.firstSeenAt ??= Date.now()
            if (Number.isFinite(body.level)) record.level = clampLevel(body.level)
            store.update((state) => {
              state.problems[slug] = record
            })
            return json({ ok: true, savedAt: Date.now() })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: save route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.run',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            await ready()
            const body = await bodyJson(request)
            const slug = slugFromInput(body.slug ?? '')
            const language = String(body.language ?? '')
            const mode = ['run', 'submit', 'coach'].includes(body.mode) ? body.mode : 'run'
            const level = clampLevel(body.level ?? 0)
            if (!slug) return json({ error: 'A problem slug is required.' }, 400)
            if (!LANGUAGE_IDS.has(language)) return json({ error: 'Choose Python, JavaScript, or C++.' }, 400)
            const code = String(body.code ?? '')
            if (code.trim() === '') return json({ error: 'Write some code first.' }, 400)
            if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
              return json({ error: 'The solution is larger than 200 KB.' }, 413)
            }
            const problem = await loadProblem(slug)
            if (problem.design) return json({ error: 'Design/class problems are not executable in the arena yet.' }, 400)
            const languages = supportedLanguages(problem.meta)
            if (!languages.includes(language)) {
              return json({ error: `${language} cannot run this problem's signature yet.` }, 400)
            }
            let tests
            let extra = []
            if (mode === 'submit') {
              tests = [
                ...(problem.tests?.visible ?? []),
                ...(problem.tests?.hidden ?? []).map((test) => ({ ...test, hidden: true })),
              ]
            } else if (mode === 'coach') {
              const requested = Array.isArray(body.extraTests) ? body.extraTests.slice(0, MAX_EXTRA_TESTS) : []
              const shaped = requested.filter(
                (test) =>
                  test &&
                  typeof test === 'object' &&
                  Array.isArray(test.args) &&
                  test.args.length === (problem.meta?.params?.length ?? 0) &&
                  Object.hasOwn(test, 'expected'),
              )
              if (shaped.length === 0) return json({ error: 'No coach tests to run.' }, 400)
              const validation = await validateCoachTests({ problem, tests: shaped, tmpRoot: store.tmpRoot })
              if (validation.tests.length === 0) {
                return json(
                  {
                    error: validation.verified
                      ? 'The coach’s cases did not agree with the reference solution, so they were not run.'
                      : 'The coach’s cases could not be validated for this problem.',
                  },
                  400,
                )
              }
              extra = validation.tests
              tests = validation.tests
            } else {
              tests = problem.tests?.visible ?? []
            }
            if (tests.length === 0) return json({ error: 'This problem has no runnable examples.' }, 400)
            const result = await runTests({
              meta: problem.meta,
              language,
              code,
              tests,
              tmpRoot: store.tmpRoot,
              compare: problem.compare ?? 'exact',
            })
            const now = Date.now()
            const record = recordFor(slug)
            record.code[language] = code
            record.firstSeenAt ??= now
            record.lastRunAt = now
            record.runs = (Number(record.runs) || 0) + 1
            record.level = level
            record.maxHintLevel = Math.max(Number(record.maxHintLevel) || 0, level)
            record.last = {
              at: now,
              passed: result.passed,
              total: result.total,
              language,
              mode,
              durationMs: result.durationMs,
              compileError: result.compileError ? String(result.compileError).slice(0, 2000) : null,
            }
            record.history = Array.isArray(record.history) ? record.history : []
            record.history.unshift({
              at: now,
              language,
              mode,
              passed: result.passed,
              total: result.total,
              durationMs: result.durationMs,
            })
            record.history = record.history.slice(0, 30)
            if (mode === 'submit') {
              record.submits = (Number(record.submits) || 0) + 1
              record.attempts = (Number(record.attempts) || 0) + 1
              if (!result.compileError && result.total > 0 && result.passed === result.total) {
                record.solved = true
                record.status = 'solved'
                record.solvedAt ??= now
                record.solvedLevel = Math.min(Number(record.solvedLevel ?? 5), level)
                record.clean = record.solvedLevel <= 1
              } else if (!record.solved) {
                record.status = 'attempted'
              }
            } else if (!record.solved) {
              record.status = 'attempted'
            }
            store.update((state) => {
              state.problems[slug] = record
            })
            void store.flush()
            return json({
              result,
              extra,
              record: publicRecord(record),
              stats: statsOf(store.get()),
            })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: run route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.coach',
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            if (request.method === 'GET') {
              pruneJobs()
              const url = new URL(request.url, 'http://localhost')
              const id = url.searchParams.get('job') ?? ''
              const job = jobs.get(id)
              if (!job) return json({ error: 'That coach job is no longer available.' }, 404)
              return json({
                id: job.id,
                status: job.status,
                text: job.text,
                error: job.error,
                tests: job.tests,
                testsVerified: job.testsVerified === true,
                testsDropped: job.testsDropped ?? 0,
                testsError: job.testsError,
                model: job.model,
                createdAt: job.createdAt,
                finishedAt: job.finishedAt ?? null,
              })
            }
            await ready()
            const body = await bodyJson(request)
            const slug = slugFromInput(body.slug ?? '')
            const language = String(body.language ?? 'python')
            const level = clampLevel(body.level ?? 0)
            const action = actionInfo(String(body.action ?? 'chat')).id
            const message = String(body.message ?? '').slice(0, MAX_COACH_MESSAGE)
            if (!slug) return json({ error: 'A problem slug is required.' }, 400)
            if (!LANGUAGE_IDS.has(language)) return json({ error: 'Unknown language.' }, 400)
            if (!actionAllowed(action, level)) {
              return json(
                {
                  error: `“${actionInfo(action).label}” needs help level L${actionInfo(action).minLevel} or higher. Raise the ceiling in the panel.`,
                  action,
                  minLevel: actionInfo(action).minLevel,
                  level,
                },
                403,
              )
            }
            const problem = await loadProblem(slug)
            const record = recordFor(slug)
            const selection = modelSelection(ctx)
            pruneJobs()
            const id = crypto.randomUUID()
            const job = {
              id,
              slug,
              action,
              level,
              status: 'running',
              text: '',
              error: null,
              tests: [],
              testsVerified: false,
              testsDropped: 0,
              testsError: null,
              model: selection ? `${selection.provider}/${selection.model}` : null,
              createdAt: Date.now(),
              finishedAt: null,
              controller: new AbortController(),
            }
            jobs.set(id, job)
            if (!selection) {
              job.status = 'error'
              job.error = 'No default model is configured. Set one in Settings → Models first.'
              job.finishedAt = Date.now()
              return json({ job: id, model: null })
            }
            const system = coachSystemPrompt({ problem, level, language })
            const userText = coachUserText({ action, message, code: body.code, language, lastRun: record.last })
            void (async () => {
              try {
                const stream = ctx.llm.stream({
                  provider: selection.provider,
                  model: selection.model,
                  system,
                  messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
                  maxTokens: 2200,
                  signal: job.controller.signal,
                })
                for await (const chunk of stream) {
                  if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') {
                    job.text += chunk.text
                  } else if (chunk?.type === 'finish') {
                    if (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted') {
                      job.error = chunk.reason?.failure?.message ?? `The model ended with ${chunk.reason.kind}.`
                    }
                    break
                  }
                }
                if (!job.text.trim() && !job.error) job.error = 'The coach returned an empty answer.'
                if (job.text.trim()) {
                  const parsed = parseCoachTests(job.text)
                  job.testsError = parsed.error
                  if (parsed.tests.length > 0) {
                    const validation = await validateCoachTests({
                      problem,
                      tests: parsed.tests,
                      tmpRoot: store.tmpRoot,
                    })
                    job.tests = validation.tests
                    job.testsVerified = validation.verified
                    job.testsDropped = validation.dropped
                  }
                  const savedAt = Date.now()
                  store.update((state) => {
                    const target = state.problems[slug] ?? (state.problems[slug] = emptyProblem())
                    target.level = level
                    target.maxHintLevel = Math.max(Number(target.maxHintLevel) || 0, level)
                    target.coach = Array.isArray(target.coach) ? target.coach : []
                    target.coach.push({
                      role: 'user',
                      text:
                        message.trim() ||
                        actionInfo(action).prompt ||
                        'Help me make progress.',
                      at: savedAt,
                      level,
                      action,
                    })
                    target.coach.push({
                      role: 'assistant',
                      text: job.text,
                      at: Date.now(),
                      level,
                      action,
                      ...(job.tests.length > 0
                        ? {
                            tests: job.tests,
                            testsVerified: job.testsVerified === true,
                            testsDropped: job.testsDropped ?? 0,
                          }
                        : {}),
                    })
                    target.coach = target.coach.slice(-40)
                  })
                  void store.flush()
                }
                job.status = job.error ? 'error' : 'done'
              } catch (error) {
                job.error = error instanceof Error ? error.message : String(error)
                job.status = 'error'
              } finally {
                job.finishedAt = Date.now()
              }
            })()
            return json({ job: id, model: job.model })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: coach route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/leetcode.reset',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            await ready()
            const body = await bodyJson(request)
            const slug = slugFromInput(body.slug ?? '')
            if (!slug) return json({ error: 'A problem slug is required.' }, 400)
            const record = recordFor(slug)
            const what = String(body.what ?? 'coach')
            if (what === 'coach' || what === 'all') {
              record.coach = []
              record.coachTests = []
            }
            if (what === 'code' || what === 'all') record.code = {}
            if (what === 'progress') {
              record.status = 'unsolved'
              record.solved = false
              record.attempts = 0
              record.submits = 0
              record.solvedAt = null
              record.solvedLevel = null
              record.clean = false
              record.history = []
              record.last = null
            }
            store.update((state) => {
              state.problems[slug] = record
            })
            void store.flush()
            return json({ record: publicRecord(record) })
          } catch (error) {
            return failure(error)
          }
        },
      }),
    'leetcode: reset route',
  )
}

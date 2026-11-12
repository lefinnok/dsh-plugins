/**
 * Host half of the DeepSeek usage monitor.
 *
 * Samples the DeepSeek balance on a fixed interval, keeps the samples in a
 * small JSON file beside the profile data, and serves them to the Web page over
 * an authenticated Connection Fetch route. The official API key balance
 * (`GET /user/balance`) is preferred; the signed-in account wallet is the
 * fallback. The Client module owns the charts.
 *
 * Row config (all optional): `intervalSeconds` (default 60), `retentionDays`
 * (14), `dataFile`, `apiKeyEnv` (`DEEPSEEK_API_KEY`), `apiBaseUrl`
 * (`https://api.deepseek.com`), `balanceTimeoutMs`, `clientVersion`, `locale`.
 * The usage budget (amount, period, currency) is written by the page into
 * `settings.json` beside the samples. `offPeakHolidays` lists Chinese public
 * holidays as `YYYY-MM-DD` so the Client's peak/off-peak badge treats them as
 * off-peak.
 *
 * @module @local/dsh-budget-monitor
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** The plugin needs the authenticated Connection Fetch registry. */
export const inject = ['connection']

/** Authenticated Fetch route on the shared `/api` channel. */
const SERIES_PATH = '/api/usage.series'
/** Authenticated route that stores the configured usage budget. */
const SETTINGS_PATH = '/api/usage.settings'
/** Accepted budget periods. */
const PERIODS = new Set(['minute', 'hour', 'day'])
/** Fallback sampling period in seconds. */
const DEFAULT_INTERVAL_SECONDS = 60
/** Never poll the platform more often than this. */
const MIN_INTERVAL_SECONDS = 30
/** Default sample retention. */
const DEFAULT_RETENTION_DAYS = 14
/** Official DeepSeek API origin used for the balance query. */
const DEFAULT_API_BASE = 'https://api.deepseek.com'
/** Default credential reference holding the DeepSeek API key. */
const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
/** Hard cap on retained samples so the JSON file stays small. */
const MAX_SAMPLES = 40000
/** A flat balance still gets a sample this often, so the line stays continuous. */
const FLAT_SAMPLE_MS = 5 * 60 * 1000
/** Budget used before the user saves one. */
const DEFAULT_BUDGET = { amount: 0, period: 'day', currency: 'CNY' }

/** DeepSeek Platform top-up page used when the account service is absent. */
const DEFAULT_TOPUP_URL = 'https://platform.deepseek.com/top_up'

/** Read one non-negative integer from untrusted config. */
function integer(value, fallback, min, max) {
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/** Read one non-empty string from untrusted config. */
function text(value, fallback) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

/** Parse a Platform decimal wallet string into a finite number. */
function amount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/** Collapse the wallet lists of one balance outcome into `{ currency: { n, b } }`. */
function walletsOf(outcome) {
  const wallets = {}
  if (!outcome || outcome.status !== 'ready') return wallets
  for (const wallet of outcome.value ?? []) {
    const entry = (wallets[wallet.currency] ??= { n: 0, b: 0 })
    entry.n = amount(wallet.balance)
  }
  for (const wallet of outcome.bonusWallets ?? []) {
    const entry = (wallets[wallet.currency] ??= { n: 0, b: 0 })
    entry.b = amount(wallet.balance)
  }
  return wallets
}

/** Validate and normalize a stored or submitted budget. */
function normalizeBudget(input) {
  if (!input || typeof input !== 'object') return null
  const value = Number(input.amount)
  if (!Number.isFinite(value) || value < 0 || value > 1e12) return null
  const period = typeof input.period === 'string' && PERIODS.has(input.period) ? input.period : 'day'
  const currency =
    typeof input.currency === 'string' && /^[A-Z]{3}$/u.test(input.currency)
      ? input.currency
      : 'CNY'
  return { amount: Math.round(value * 100) / 100, period, currency }
}

/** Stable identity of one balance sample, used to skip unchanged writes. */
function fingerprint(wallets) {
  return Object.keys(wallets)
    .sort()
    .map((currency) => `${currency}:${wallets[currency].n}:${wallets[currency].b}`)
    .join('|')
}

/** Resolve the profile-specific data file. */
function resolveDataFile(config) {
  if (typeof config.dataFile === 'string' && config.dataFile.trim() !== '') {
    return config.dataFile.trim()
  }
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const profile = text(process.env.DSH_PROFILE, 'default')
  return join(home, 'budget-monitor', `samples-${profile}.json`)
}

/** Token-usage persistence version. */
const TOKENS_VERSION = 1
/** Durable token buckets shared by the dashboard and the usage page. */
const TOKEN_BUCKETS = ['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']

/** One zero token bucket. */
function zeroTokenBuckets() {
  return {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

/** Normalize one untrusted token bucket. */
function normalizeTokenBuckets(value) {
  const out = zeroTokenBuckets()
  if (!value || typeof value !== 'object') return out
  for (const bucket of TOKEN_BUCKETS) {
    const number = Number(value[bucket])
    out[bucket] = Number.isFinite(number) && number > 0 ? Math.round(number) : 0
  }
  return out
}

/** Sum several token buckets. */
function sumTokenBuckets(entries) {
  const out = zeroTokenBuckets()
  for (const entry of entries) {
    for (const bucket of TOKEN_BUCKETS) out[bucket] += Math.max(0, Number(entry?.[bucket]) || 0)
  }
  return out
}

/** Local calendar day key. */
function tokenDayKey(now = Date.now()) {
  const date = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Normalize one context-pressure reading. */
function normalizeContext(value) {
  if (!value || typeof value !== 'object') return null
  const out = {}
  for (const key of ['pressureTokens', 'projectedTokens', 'contextWindow']) {
    const number = Number(value[key])
    if (Number.isFinite(number) && number >= 0) out[key] = Math.round(number)
  }
  return Object.keys(out).length === 0 ? null : out
}

/** Local start of a budget period. */
function periodStart(period, now) {
  const date = new Date(now)
  if (period === 'minute') {
    date.setSeconds(0, 0)
    return date.getTime()
  }
  if (period === 'hour') {
    date.setMinutes(0, 0, 0)
    return date.getTime()
  }
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Total of the normal and bonus wallets for one currency in one sample. */
function walletTotal(wallets, currency) {
  const entry = wallets?.[currency]
  if (!entry) return null
  return amount(entry.n) + amount(entry.b)
}

/**
 * Spend between two instants derived from consecutive samples of the same
 * source. This is the same decrease-only fold the usage page uses, so the
 * dashboard reports the same today/budget figures.
 */
function spendBetween(samples, currency, from, to) {
  let spend = 0
  if (!Array.isArray(samples)) return 0
  for (let index = 1; index < samples.length; index += 1) {
    const later = samples[index]
    if (later.t <= from || later.t > to) continue
    if (samples[index - 1].s !== later.s) continue
    const before = walletTotal(samples[index - 1].w, currency)
    const after = walletTotal(later.w, currency)
    if (before === null || after === null) continue
    const delta = after - before
    if (delta < -1e-9) spend -= delta
  }
  return Math.round(spend * 1e6) / 1e6
}

/** Currency shown first: configured budget currency, then CNY, then the first wallet. */
function preferredCurrency(samples, budget) {
  const latest = samples[samples.length - 1]
  const currencies = latest ? Object.keys(latest.w ?? {}) : []
  const configured = budget?.currency
  if (configured && currencies.includes(configured)) return configured
  if (currencies.includes('CNY')) return 'CNY'
  return currencies[0] ?? configured ?? 'CNY'
}

/**
 * Canonical cost summary shared with the usage page's currency and decrease
 * semantics: primary currency, today's spend, wallet rows, and the budget
 * period's spend/ratio.
 */
function costSummaryOf(samples, budget, now = Date.now()) {
  const latest = samples[samples.length - 1]
  const available = latest !== undefined && latest !== null
  const currency = preferredCurrency(samples, budget)
  const midnight = periodStart('day', now)
  const spentToday = spendBetween(samples, currency, midnight, now)
  const budgetCurrency = budget?.currency ?? currency
  const budgetSpent = spendBetween(samples, budgetCurrency, periodStart(budget?.period ?? 'day', now), now)
  const amountValue = Number(budget?.amount) || 0
  const currencies = latest ? Object.keys(latest.w ?? {}) : []
  return {
    available,
    currency,
    spentToday,
    today: currencies.map((code) => ({
      currency: code,
      spent: spendBetween(samples, code, midnight, now),
    })),
    remaining: latest
      ? Object.entries(latest.w ?? {}).map(([code, entry]) => ({
          currency: code,
          normal: amount(entry.n),
          bonus: amount(entry.b),
        }))
      : [],
    budget: budget
      ? {
          ...budget,
          spent: budgetSpent,
          ratio: amountValue > 0 ? budgetSpent / amountValue : 0,
        }
      : null,
  }
}

/**
 * Register the budget monitor.
 * @param ctx - Host context with Connection; the account service is optional.
 * @param config - row config from `cordis.patch.yml`.
 */
export function apply(ctx, config) {
  const options = config && typeof config === 'object' ? config : {}
  const intervalSeconds = integer(
    options.intervalSeconds,
    DEFAULT_INTERVAL_SECONDS,
    MIN_INTERVAL_SECONDS,
    3600,
  )
  const retentionDays = integer(options.retentionDays, DEFAULT_RETENTION_DAYS, 1, 90)
  const dataFile = resolveDataFile(options)
  const settingsFile = join(dirname(dataFile), 'settings.json')
  const tokensFile = join(dirname(dataFile), `tokens-${text(process.env.DSH_PROFILE, 'default')}.json`)
  let budget = { ...DEFAULT_BUDGET }
  let settingsChain = Promise.resolve()
  let tokenState = {
    version: TOKENS_VERSION,
    day: tokenDayKey(),
    trackedSince: null,
    sessions: {},
  }
  let tokenChain = Promise.resolve()
  let tokenPersistTimer = null
  let tokenPersistChain = Promise.resolve()
  let topUpUrl = DEFAULT_TOPUP_URL
  const apiKeyEnv = text(options.apiKeyEnv, DEFAULT_API_KEY_ENV)
  const apiBase = text(options.apiBaseUrl, DEFAULT_API_BASE).replace(/\/+$/u, '')
  const apiTimeoutMs = integer(options.balanceTimeoutMs, 15000, 1000, 60000)
  const offPeakHolidays = Array.isArray(options.offPeakHolidays)
    ? options.offPeakHolidays.filter(
        (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value),
      )
    : []
  const clientMetadata = () => ({
    version: text(options.clientVersion, '0.2.1-rc.5'),
    locale: text(options.locale, 'en'),
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  })

  /** Adopt the account service's top-up destination when it exposes one. */
  const loadTopUpUrl = async () => {
    const account = ctx.get('deepseekAccount')
    if (!account || typeof account.getState !== 'function') return
    try {
      const state = await account.getState()
      const url = state?.links?.topUpUrl
      if (typeof url === 'string' && /^https?:\/\//u.test(url)) topUpUrl = url
    } catch (error) {
      console.error('[usage-monitor] account state unavailable:', error?.message ?? error)
    }
  }
  void loadTopUpUrl()

  /** The stored API key, the launch environment, or undefined. */
  const resolveApiKey = async () => {
    const credentials = ctx.get('credentials')
    if (credentials && typeof credentials.resolve === 'function') {
      try {
        const hit = await credentials.resolve(apiKeyEnv)
        if (hit && typeof hit.value === 'string' && hit.value.length > 0) return hit.value
      } catch (error) {
        console.error('[usage-monitor] credential lookup failed:', error?.message ?? error)
      }
    }
    const ambient = process.env[apiKeyEnv]
    return typeof ambient === 'string' && ambient.length > 0 ? ambient : null
  }

  /** Query the official API balance endpoint for the configured key. */
  const apiBalance = async () => {
    const apiKey = await resolveApiKey()
    if (!apiKey) return null
    const response = await fetch(`${apiBase}/user/balance`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(apiTimeoutMs),
      redirect: 'error',
    })
    if (!response.ok) {
      const failure = new Error(`balance HTTP ${response.status}`)
      failure.code = response.status === 401 ? 'invalid-api-key' : 'balance-request-failed'
      throw failure
    }
    const body = await response.json()
    if (!body || !Array.isArray(body.balance_infos)) {
      const failure = new Error('balance response is malformed')
      failure.code = 'balance-response-invalid'
      throw failure
    }
    const wallets = {}
    for (const info of body.balance_infos) {
      if (!info || typeof info.currency !== 'string') continue
      wallets[info.currency] = {
        n: amount(info.topped_up_balance),
        b: amount(info.granted_balance),
      }
    }
    return { wallets, available: body.is_available !== false }
  }

  const loadBudget = async () => {
    try {
      const parsed = normalizeBudget(JSON.parse(await readFile(settingsFile, 'utf8')))
      if (parsed) budget = parsed
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.error('[usage-monitor] failed to load settings:', error?.message ?? error)
      }
    }
  }
  const settingsReady = loadBudget()

  const saveBudget = (next) => {
    budget = next
    const payload = JSON.stringify(next)
    settingsChain = settingsChain
      .then(async () => {
        await mkdir(dirname(settingsFile), { recursive: true })
        const temporary = `${settingsFile}.tmp`
        await writeFile(temporary, payload, 'utf8')
        await rename(temporary, settingsFile)
      })
      .catch((error) => {
        console.error('[usage-monitor] failed to persist settings:', error?.message ?? error)
      })
    return settingsChain
  }


  /** Load the persisted daily token ledger. */
  const loadTokens = async () => {
    try {
      const parsed = JSON.parse(await readFile(tokensFile, 'utf8'))
      if (!parsed || typeof parsed !== 'object') return
      if (typeof parsed.day === 'string') tokenState.day = parsed.day
      if (typeof parsed.trackedSince === 'number') tokenState.trackedSince = parsed.trackedSince
      if (parsed.sessions && typeof parsed.sessions === 'object') {
        const loaded = {}
        for (const [id, entry] of Object.entries(parsed.sessions)) {
          if (!entry || typeof entry !== 'object') continue
          loaded[id] = {
            last: entry.last ? normalizeTokenBuckets(entry.last) : null,
            today: normalizeTokenBuckets(entry.today),
            updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
          }
        }
        tokenState.sessions = loaded
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.error('[usage-monitor] failed to load tokens:', error?.message ?? error)
      }
    }
  }
  const tokenReady = loadTokens()

  /** Persist the token ledger atomically. */
  const persistTokens = () => {
    const payload = JSON.stringify({
      version: TOKENS_VERSION,
      day: tokenState.day,
      trackedSince: tokenState.trackedSince,
      sessions: tokenState.sessions,
    })
    tokenPersistChain = tokenPersistChain
      .then(async () => {
        await mkdir(dirname(tokensFile), { recursive: true })
        const temporary = `${tokensFile}.tmp`
        await writeFile(temporary, payload, 'utf8')
        await rename(temporary, tokensFile)
      })
      .catch((error) => {
        console.error('[usage-monitor] failed to persist tokens:', error?.message ?? error)
      })
    return tokenPersistChain
  }

  const schedulePersistTokens = () => {
    if (tokenPersistTimer !== null) clearTimeout(tokenPersistTimer)
    tokenPersistTimer = setTimeout(() => {
      tokenPersistTimer = null
      void persistTokens()
    }, 1500)
  }

  /** Read one token snapshot for the route, including today's per-session deltas. */
  const buildTokenSnapshot = (contextById) => {
    const sessionsOut = {}
    for (const [id, entry] of Object.entries(tokenState.sessions)) {
      if (!entry || (!entry.last && !entry.today && !contextById?.[id])) continue
      sessionsOut[id] = {
        today: { ...entry.today },
        totals: entry.last ? { ...entry.last } : null,
        context: contextById?.[id] ? { ...contextById[id] } : null,
      }
    }
    const today = sumTokenBuckets(Object.values(sessionsOut).map((entry) => entry.today))
    return {
      day: tokenState.day,
      trackedSince: tokenState.trackedSince,
      today,
      sessions: sessionsOut,
    }
  }

  /**
   * Fold the current token/context projections into the daily ledger.
   * Runs on every usage route request so idle dashboard gaps become one delta.
   */
  const ensureTokens = async () => {
    await tokenReady
    tokenChain = tokenChain.catch(() => undefined).then(() => {
      const now = Date.now()
      const day = tokenDayKey(now)
      if (tokenState.day !== day) {
        tokenState.day = day
        tokenState.trackedSince = now
        for (const entry of Object.values(tokenState.sessions)) entry.today = zeroTokenBuckets()
      }
      tokenState.trackedSince ??= now
      const sessionService = ctx.get('sessions')
      const projectionService = ctx.get('sessionProjections')
      if (!sessionService || !projectionService || typeof sessionService.list !== 'function') return null
      const contextById = {}
      let live = []
      try {
        live = sessionService.list()
      } catch {
        live = []
      }
      for (const session of live) {
        let snapshot
        try {
          snapshot = projectionService.snapshot(session)
        } catch {
          continue
        }
        const values = snapshot?.values ?? {}
        const usage = values.tokenUsage ? normalizeTokenBuckets(values.tokenUsage) : null
        const context = normalizeContext(values.contextPressure)
        const entry =
          tokenState.sessions[session.id] ??
          (tokenState.sessions[session.id] = {
            last: null,
            today: zeroTokenBuckets(),
            updatedAt: now,
          })
        if (usage) {
          if (entry.last) {
            for (const bucket of TOKEN_BUCKETS) {
              entry.today[bucket] += Math.max(0, usage[bucket] - entry.last[bucket])
            }
          }
          entry.last = usage
        }
        entry.updatedAt = now
        if (context) contextById[session.id] = context
      }
      const cutoff = now - 3 * 24 * 60 * 60 * 1000
      for (const [id, entry] of Object.entries(tokenState.sessions)) {
        if (entry.updatedAt < cutoff) delete tokenState.sessions[id]
      }
      const ordered = Object.entries(tokenState.sessions).sort(
        (left, right) => (right[1].updatedAt ?? 0) - (left[1].updatedAt ?? 0),
      )
      if (ordered.length > 500) {
        tokenState.sessions = Object.fromEntries(ordered.slice(0, 500))
      }
      schedulePersistTokens()
      return buildTokenSnapshot(contextById)
    })
    return tokenChain
  }

  /** @type {Array<{ t: number, s: string, w: Record<string, { n: number, b: number }> }>} */
  let samples = []
  const status = {
    state: 'starting',
    error: null,
    source: null,
    available: null,
    updatedAt: null,
  }
  let inflight = null
  let persistTimer = null
  let persistChain = Promise.resolve()
  let stopped = false

  const prune = () => {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    samples = samples.filter((sample) => sample.t >= cutoff)
    if (samples.length > MAX_SAMPLES) samples = samples.slice(samples.length - MAX_SAMPLES)
  }

  const persist = () => {
    const payload = JSON.stringify({
      version: 1,
      intervalSeconds,
      retentionDays,
      samples,
    })
    persistChain = persistChain
      .then(async () => {
        await mkdir(dirname(dataFile), { recursive: true })
        const temporary = `${dataFile}.tmp`
        await writeFile(temporary, payload, 'utf8')
        await rename(temporary, dataFile)
      })
      .catch((error) => {
        console.error('[usage-monitor] failed to persist samples:', error?.message ?? error)
      })
    return persistChain
  }

  const schedulePersist = () => {
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      void persist()
    }, 1500)
  }

  const load = async () => {
    try {
      const parsed = JSON.parse(await readFile(dataFile, 'utf8'))
      const stored = Array.isArray(parsed?.samples) ? parsed.samples : []
      samples = stored.filter(
        (sample) =>
          sample &&
          typeof sample.t === 'number' &&
          Number.isFinite(sample.t) &&
          sample.w &&
          typeof sample.w === 'object',
      )
      prune()
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.error('[usage-monitor] failed to load samples:', error?.message ?? error)
      }
    }
  }

  const samplesReady = load()

  const record = (source, wallets, available) => {
    status.state = 'ok'
    status.error = null
    status.source = source
    status.available = available
    status.updatedAt = Date.now()
    if (Object.keys(wallets).length === 0) return
    const last = samples[samples.length - 1]
    const changed =
      !last || last.s !== source || fingerprint(last.w) !== fingerprint(wallets)
    if (changed || status.updatedAt - last.t >= FLAT_SAMPLE_MS) {
      samples.push({ t: status.updatedAt, s: source, w: wallets })
      prune()
      schedulePersist()
    }
  }

  const sample = () => {
    if (inflight) return inflight
    inflight = (async () => {
      let apiError = null
      let apiResult = null
      try {
        apiResult = await apiBalance()
      } catch (error) {
        apiError = error
      }
      if (apiResult) {
        record('api-key', apiResult.wallets, apiResult.available)
        return
      }

      const account = ctx.get('deepseekAccount')
      if (account) {
        try {
          const outcome = await account.getBalance(clientMetadata())
          if (outcome && outcome.status === 'ready') {
            record('account', walletsOf(outcome), outcome.status === 'ready')
            return
          }
          if (!outcome) {
            status.updatedAt = Date.now()
            status.source = 'account'
            status.state = apiError ? 'error' : 'signed-out'
            status.error = apiError ? (apiError.code ?? 'balance-request-failed') : null
            return
          }
          status.updatedAt = Date.now()
          status.source = 'account'
          status.state = 'error'
          status.error = 'balance-unavailable'
          return
        } catch (error) {
          apiError ??= error
        }
      }

      status.updatedAt = Date.now()
      if (apiError) {
        status.state = 'error'
        status.error = apiError.code ?? 'balance-request-failed'
        console.error('[usage-monitor] balance request failed:', apiError?.message ?? apiError)
      } else {
        status.state = 'signed-out'
        status.error = null
      }
    })().finally(() => {
      inflight = null
    })
    return inflight
  }

  const snapshot = (requestUrl, tokenSnapshot) => {
    const url = new URL(requestUrl, 'http://localhost')
    const days = integer(url.searchParams.get('days'), retentionDays, 1, 90)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const visible = samples.filter((entry) => entry.t >= cutoff)
    const latest = visible[visible.length - 1]
    return {
      status: status.state,
      error: status.error,
      source: status.source,
      available: status.available,
      updatedAt: status.updatedAt,
      trackingSince: samples[0]?.t ?? null,
      intervalSeconds,
      retentionDays,
      settings: budget,
      offPeakHolidays,
      topUpUrl,
      wallets: latest
        ? Object.entries(latest.w).map(([currency, entry]) => ({
            currency,
            normal: entry.n,
            bonus: entry.b,
          }))
        : [],
      samples: visible,
      tokens: tokenSnapshot,
      cost: costSummaryOf(visible, budget),
    }
  }

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: SERIES_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          await Promise.all([settingsReady, samplesReady])
          const url = new URL(request.url, 'http://localhost')
          if (url.searchParams.get('refresh') === '1') await sample()
          const tokenSnapshot = await ensureTokens()
          return Response.json(snapshot(request.url, tokenSnapshot), {
            headers: { 'cache-control': 'no-store' },
          })
        },
      }),
    'usage-monitor: series route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: SETTINGS_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          await settingsReady
          let body
          try {
            body = await request.json()
          } catch {
            return Response.json({ error: 'invalid-json' }, { status: 400 })
          }
          const next = normalizeBudget(body)
          if (!next) return Response.json({ error: 'invalid-budget' }, { status: 400 })
          await saveBudget(next)
          return Response.json(
            { settings: next },
            { headers: { 'cache-control': 'no-store' } },
          )
        },
      }),
    'usage-monitor: settings route',
  )

  ctx.effect(() => {
    stopped = false
    void Promise.all([samplesReady, tokenReady]).then(() => {
      if (!stopped) void sample()
    })
    const timer = setInterval(() => {
      if (!stopped) void sample()
    }, intervalSeconds * 1000)
    return async () => {
      stopped = true
      clearInterval(timer)
      if (persistTimer !== null) {
        clearTimeout(persistTimer)
        persistTimer = null
        const payload = JSON.stringify({
          version: 1,
          intervalSeconds,
          retentionDays,
          samples,
        })
        await mkdir(dirname(dataFile), { recursive: true }).catch(() => {})
        await writeFile(dataFile, payload, 'utf8').catch(() => {})
      }
      await persistChain.catch(() => {})
      if (tokenPersistTimer !== null) {
        clearTimeout(tokenPersistTimer)
        tokenPersistTimer = null
        await persistTokens()
      }
      await tokenPersistChain.catch(() => {})
    }
  }, 'usage-monitor: sampler')
}

/**
 * Host half of the Agent Dashboard (`@local/dsh-dashboard`).
 *
 * Subscribes to the live session event feed and keeps a small in-memory ring of
 * human-readable activity lines for each top-level agent. The browser dashboard
 * reads the ring over an authenticated Connection Fetch route. No session data
 * is persisted or replayed: the feed starts when this plugin activates, and the
 * client falls back to status and last-prompt data after a host restart.
 *
 * @module @local/dsh-dashboard
 */

/** The plugin needs the authenticated Connection Fetch registry. */
export const inject = ['connection']

/** Authenticated route the dashboard polls. */
const ACTIVITY_PATH = '/api/dashboard.activity'
/** Maximum activity lines retained per agent. */
const MAX_ITEMS = 5
/** Bound on one activity line. */
const MAX_TEXT = 160
/** Bound on remembered agents. */
const MAX_SESSIONS = 300

/** Collapse whitespace and cap one line. */
function line(value, max = MAX_TEXT) {
  const text = String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Extract the text blocks of one model message. */
function textOf(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join(' ')
}

/** A compact hint from a raw tool-argument JSON string. */
function argumentHint(raw) {
  const source = String(raw ?? '')
  try {
    const parsed = JSON.parse(source)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of ['command', 'path', 'file_path', 'query', 'pattern', 'url', 'description', 'goal']) {
        if (typeof parsed[key] === 'string' && parsed[key].trim() !== '') return line(parsed[key], 60)
      }
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.trim() !== '') return line(value, 60)
      }
    }
  } catch {
    /* fall through to the raw argument text */
  }
  return line(source, 60)
}

/** One record per top-level agent. */
function createRecord() {
  return {
    items: [],
    lastActivityAt: 0,
    lastFailureAt: null,
    failed: false,
    /** Tool call identity to tool name, only for naming failed results. */
    calls: new Map(),
    updatedAt: 0,
  }
}

/**
 * Register the dashboard activity feed.
 * @param ctx - host context with the Connection Fetch registry.
 */
export function apply(ctx) {
  /** @type {Map<string, ReturnType<typeof createRecord>>} */
  const records = new Map()
  /** Subagent session id to direct parent session id. */
  const parents = new Map()

  const recordFor = (id) => {
    let record = records.get(id)
    if (record === undefined) {
      record = createRecord()
      records.set(id, record)
    }
    return record
  }

  const touch = (id, time) => {
    const record = recordFor(id)
    record.lastActivityAt = Math.max(record.lastActivityAt, Number(time) || 0)
    record.updatedAt = Date.now()
    if (records.size > MAX_SESSIONS) prune()
  }

  const push = (id, kind, text, time, seq, variant, detail) => {
    const record = recordFor(id)
    const stamp = Number(time) || Date.now()
    record.lastActivityAt = Math.max(record.lastActivityAt, stamp)
    record.updatedAt = Date.now()
    record.items.push({
      seq: typeof seq === 'number' ? seq : 0,
      time: stamp,
      kind,
      variant: variant ?? kind,
      text: line(text),
      detail: detail === undefined ? undefined : line(detail, 80),
    })
    if (record.items.length > MAX_ITEMS) record.items.splice(0, record.items.length - MAX_ITEMS)
    if (records.size > MAX_SESSIONS) prune()
  }

  const prune = () => {
    if (records.size <= MAX_SESSIONS) return
    const ordered = [...records.entries()].sort(
      (left, right) => (right[1].lastActivityAt || 0) - (left[1].lastActivityAt || 0),
    )
    for (const [id] of ordered.slice(MAX_SESSIONS)) records.delete(id)
  }

  /** Summarize one event from a top-level session. */
  const onSessionEvent = (session, event) => {
    const time = Number(event?.time) || Date.now()
    if (session?.header?.origin === 'subagent') {
      // A child doing work is still activity for its parent: it keeps the
      // parent card in today/active ranking even when the parent turn is idle.
      const parentId = session.header?.parentSession
      if (parentId !== undefined) touch(parentId, time)
      return
    }
    const id = session.id
    if (id === undefined) return
    const seq = Number(event?.seq) || 0
    const data = event?.data ?? {}
    switch (event?.type) {
      case 'user/message': {
        if (data.source?.kind !== 'user') return
        push(id, 'input', line(textOf(data.content), 100), time, seq, 'input')
        return
      }
      case 'assistant/message': {
        const text = line(textOf(data.message?.content), 120)
        if (text === '') {
          touch(id, time)
          return
        }
        push(id, 'output', text, time, seq, 'output')
        return
      }
      case 'tool/call': {
        const name = line(data.name, 48)
        if (data.callId !== undefined) recordFor(id).calls.set(data.callId, name)
        if (name === 'ask_user_question') {
          push(id, 'waiting', '', time, seq, 'waiting-answer')
          return
        }
        push(id, 'tool', name, time, seq, 'tool', argumentHint(data.arguments))
        return
      }
      case 'tool/result': {
        const callId = data.callId ?? data.message?.toolCallId ?? data.message?.source?.callId
        const failed = Boolean(data.error) || data.message?.isError === true
        if (failed) {
          const name = callId === undefined ? '' : recordFor(id).calls.get(callId) ?? ''
          push(id, 'error', name, time, seq, 'tool-failed')
        } else {
          touch(id, time)
        }
        if (callId !== undefined) recordFor(id).calls.delete(callId)
        return
      }
      case 'turn/start': {
        recordFor(id).failed = false
        push(id, 'turn', '', time, seq, 'turn-start')
        return
      }
      case 'turn/end': {
        const reason = data.reason?.kind
        const failed = reason === 'error' || reason === 'crashed'
        const record = recordFor(id)
        record.failed = failed
        if (failed) record.lastFailureAt = time
        const variant =
          reason === 'completed'
            ? 'turn-completed'
            : reason === 'error' || reason === 'crashed'
              ? 'turn-failed'
              : reason === 'aborted'
                ? 'turn-stopped'
                : reason === 'blocked'
                  ? 'turn-blocked'
                  : reason === 'max-tokens'
                    ? 'turn-max-tokens'
                    : 'turn-ended'
        push(id, failed ? 'error' : 'turn', '', time, seq, variant)
        record.calls.clear()
        return
      }
      default:
        return
    }
  }

  const onSessionCreated = (session) => {
    const parentId = session?.header?.parentSession
    if (session?.header?.origin !== 'subagent' || parentId === undefined || session?.id === undefined) return
    parents.set(session.id, parentId)
    push(parentId, 'subagent', '', session.header?.createdAt ?? Date.now(), 0, 'subagent-start')
    prune()
  }

  const onSessionDisposed = (session) => {
    const id = session?.id
    if (id === undefined) return
    const parentId = parents.get(id)
    parents.delete(id)
    if (parentId !== undefined) {
      push(parentId, 'subagent', '', Date.now(), 0, 'subagent-finish')
      prune()
      return
    }
    records.delete(id)
  }

  ctx.on('session/event', onSessionEvent)
  ctx.on('session/created', onSessionCreated)
  ctx.on('session/disposed', onSessionDisposed)

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ACTIVITY_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          const sessions = {}
          for (const [id, record] of records) {
            if (record.lastActivityAt === 0 && record.items.length === 0) continue
            sessions[id] = {
              lastActivityAt: record.lastActivityAt,
              lastFailureAt: record.lastFailureAt,
              failed: record.failed,
              items: record.items.slice(),
            }
          }
          return Response.json(
            { updatedAt: Date.now(), sessions },
            { headers: { 'cache-control': 'no-store' } },
          )
        },
      }),
    'dashboard: activity route',
  )
}

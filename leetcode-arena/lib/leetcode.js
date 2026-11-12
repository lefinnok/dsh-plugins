/**
 * LeetCode's public GraphQL surface.
 *
 * The arena uses it for two things: browsing the free problem catalog and
 * importing a problem's statement, starter code, signature metadata, hints, and
 * visible examples. No account, cookie, or premium subscription is involved.
 */
import {
  isDesignProblem,
  normalizeMeta,
  supportedLanguages,
} from './harness.js'

const GRAPHQL = 'https://leetcode.com/graphql'
const HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json',
  referer: 'https://leetcode.com/problemset/',
  origin: 'https://leetcode.com',
  'user-agent': 'Mozilla/5.0 (compatible; DSH-LeetCode-Arena/1.0)',
}

const CATALOG_QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data {
      frontendQuestionId: questionFrontendId
      title
      titleSlug
      difficulty
      paidOnly: isPaidOnly
      topicTags { name slug }
      acRate
    }
  }
}`

const QUESTION_QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    titleSlug
    difficulty
    isPaidOnly
    content
    exampleTestcases
    exampleTestcaseList
    metaData
    hints
    topicTags { name slug }
    codeSnippets { lang langSlug code }
  }
}`

class LeetCodeError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'LeetCodeError'
    this.status = status
  }
}

async function gql(query, variables) {
  let response
  try {
    response = await fetch(GRAPHQL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? 'LeetCode did not answer within 20s' : String(error?.message ?? error)
    throw new LeetCodeError(`Could not reach LeetCode: ${reason}`)
  }
  if (!response.ok) throw new LeetCodeError(`LeetCode answered HTTP ${response.status}`, response.status)
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new LeetCodeError('LeetCode returned a non-JSON response', response.status)
  }
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new LeetCodeError(payload.errors.map((entry) => entry?.message).filter(Boolean).join('; '))
  }
  if (!payload?.data) throw new LeetCodeError('LeetCode returned no data')
  return payload.data
}

/** Fetch one page of the free catalog. */
export async function fetchCatalog({ search = '', difficulty = '', page = 0, limit = 50 } = {}) {
  const filters = {}
  if (search.trim() !== '') filters.searchKeywords = search.trim()
  if (['EASY', 'MEDIUM', 'HARD'].includes(String(difficulty).toUpperCase())) {
    filters.difficulty = String(difficulty).toUpperCase()
  }
  const size = Math.max(1, Math.min(100, Number(limit) || 50))
  const skip = Math.max(0, Number(page) || 0) * size
  const data = await gql(CATALOG_QUERY, { categorySlug: '', limit: size, skip, filters })
  const list = data?.problemsetQuestionList
  if (!list) throw new LeetCodeError('LeetCode catalog response was incomplete')
  return {
    total: Number(list.total) || 0,
    items: (list.questions ?? []).map((q) => ({
      id: String(q.frontendQuestionId ?? ''),
      slug: q.titleSlug,
      title: q.title,
      difficulty: titleCase(q.difficulty),
      tags: (q.topicTags ?? []).map((tag) => tag.name),
      acRate: typeof q.acRate === 'number' ? q.acRate : null,
      paid: q.paidOnly === true,
    })),
  }
}

/** Fetch one problem's raw GraphQL payload. */
export async function fetchQuestion(slug) {
  const clean = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(clean)) throw new LeetCodeError('That does not look like a LeetCode slug.')
  const data = await gql(QUESTION_QUERY, { titleSlug: clean })
  if (!data?.question) throw new LeetCodeError(`LeetCode has no problem named “${clean}”.`, 404)
  return data.question
}

/** Accept a full LeetCode URL, a path, or a bare slug. */
export function slugFromInput(text) {
  const raw = String(text ?? '').trim()
  if (raw === '') return ''
  const match = raw.match(/\/problems\/([a-z0-9-]+)/i)
  if (match) return match[1].toLowerCase()
  if (/^https?:\/\//i.test(raw)) return ''
  return raw.replace(/^\/+|\/+$/g, '').toLowerCase()
}

function titleCase(value) {
  const text = String(value ?? '')
  return text === '' ? '' : text[0].toUpperCase() + text.slice(1).toLowerCase()
}

const ENTITIES = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&times;': '×',
  '&le;': '≤',
  '&ge;': '≥',
}

function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/&nbsp;/g, ' ')
}

/** Convert a LeetCode HTML statement into readable text with line breaks. */
export function htmlToText(html) {
  const text = String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|pre|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/?code[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Convert a LeetCode HTML statement into the arena's Markdown renderer dialect. */
export function htmlToMarkdown(html) {
  let text = String(html ?? '')
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => {
    const body = htmlToText(inner).replace(/\n+$/g, '')
    return `\n\n\`\`\`\n${body}\n\`\`\`\n\n`
  })
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '^$1')
    .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '_$1')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(div|h[1-6]|ul|ol|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Split on top-level commas and newlines, respecting brackets and quotes. */
function splitTopLevel(text) {
  const parts = []
  let current = ''
  let depth = 0
  let quote = ''
  let escaped = false
  for (const ch of String(text)) {
    if (quote !== '') {
      current += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === '[' || ch === '{' || ch === '(') depth += 1
    if (ch === ']' || ch === '}' || ch === ')') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === '\n') && depth === 0) {
      if (current.trim() !== '') parts.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim() !== '') parts.push(current.trim())
  return parts
}

function topLevelEquals(text) {
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quote !== '') {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '[' || ch === '{' || ch === '(') depth += 1
    if (ch === ']' || ch === '}' || ch === ')') depth = Math.max(0, depth - 1)
    if (ch === '=' && depth === 0) return i
  }
  return -1
}

function parseValue(text) {
  let value = String(text ?? '').trim()
  if (!/^["'`]/.test(value)) value = value.replace(/[.!]+$/g, '').trim()
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    /* try the LeetCode-friendly spellings below */
  }
  if (/^true$/i.test(value)) return { ok: true, value: true }
  if (/^false$/i.test(value)) return { ok: true, value: false }
  if (/^(null|none|nil)$/i.test(value)) return { ok: true, value: null }
  if (/^[+-]?\d+(\.\d+)?$/.test(value)) return { ok: true, value: Number(value) }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('`') && value.endsWith('`'))
  ) {
    return { ok: true, value: value.slice(1, -1) }
  }
  return { ok: false, value }
}

function parseInputs(text, params) {
  const parts = splitTopLevel(text)
  const named = new Map()
  const positional = []
  for (const part of parts) {
    const equals = topLevelEquals(part)
    if (equals > 0) {
      const name = part.slice(0, equals).trim()
      const raw = part.slice(equals + 1).trim()
      const parsed = parseValue(raw)
      if (parsed.ok) named.set(name, parsed.value)
    } else {
      const parsed = parseValue(part)
      if (parsed.ok) positional.push(parsed.value)
    }
  }
  const args = []
  for (const [index, param] of params.entries()) {
    if (named.has(param.name)) {
      args.push(named.get(param.name))
    } else if (positional[index] !== undefined) {
      args.push(positional[index])
    } else {
      return null
    }
  }
  return args
}

/**
 * Extract example tests from a statement.
 *
 * The visible cases are deliberately best-effort: some LeetCode statements
 * express examples only as a picture or a design trace, and those are skipped
 * rather than guessed.
 */
export function parseExamples(html, meta) {
  if (!meta || meta.design || !Array.isArray(meta.params) || meta.params.length === 0) return []
  const text = htmlToText(html)
  const examples = []
  const pattern = /(?:^|\n)\s*Input:\s*([\s\S]*?)\s*Output:\s*([\s\S]*?)(?=\n\s*Explanation:|\n\s*Example\s+\d+|\n\s*Constraints:|\n\s*Follow-up:|\n\s*Note:|$)/gi
  for (const match of text.matchAll(pattern)) {
    const inputText = match[1].trim()
    const outputText = match[2].trim()
    if (!inputText || !outputText) continue
    const args = parseInputs(inputText, meta.params)
    const expected = parseValue(outputText)
    if (!args || !expected.ok) continue
    const key = JSON.stringify([args, expected.value])
    if (examples.some((entry) => entry.key === key)) continue
    examples.push({
      key,
      input: inputText,
      output: outputText,
      args,
      expected: expected.value,
    })
  }
  return examples
}

/** Turn a raw GraphQL question into the arena's Problem shape. */
export function parseQuestion(raw) {
  const meta = normalizeMeta(raw?.metaData)
  const tags = (raw?.topicTags ?? []).map((tag) => tag.name).filter(Boolean)
  const starters = {}
  for (const snippet of raw?.codeSnippets ?? []) {
    if (snippet?.langSlug === 'python3' && typeof snippet.code === 'string') starters.python = snippet.code
    if (snippet?.langSlug === 'javascript' && typeof snippet.code === 'string') starters.javascript = snippet.code
    if (snippet?.langSlug === 'cpp' && typeof snippet.code === 'string') starters.cpp = snippet.code
  }
  const examples = parseExamples(raw?.content, meta)
  const languageSupport = supportedLanguages(meta)
  return {
    slug: raw?.titleSlug,
    frontendId: raw?.questionFrontendId ?? null,
    title: raw?.title ?? raw?.titleSlug,
    difficulty: titleCase(raw?.difficulty),
    tags,
    pattern: tags[0] ?? '',
    source: 'leetcode',
    order: 9999,
    statement: htmlToMarkdown(raw?.content),
    examples: examples.map(({ input, output }) => ({ input, output })),
    constraints: [],
    meta,
    starters,
    hints: (raw?.hints ?? []).map((hint) => htmlToText(hint)).filter(Boolean),
    tests: {
      visible: examples.map(({ args, expected }) => ({ args, expected })),
      hidden: [],
    },
    visibleCount: examples.length,
    hiddenCount: 0,
    runnable: examples.length > 0 && languageSupport.length > 0,
    supportedLanguages: languageSupport,
    design: meta?.design === true || isDesignProblem(raw?.metaData),
    paidOnly: raw?.isPaidOnly === true,
    url: `https://leetcode.com/problems/${raw?.titleSlug ?? ''}/`,
  }
}

export { LeetCodeError }

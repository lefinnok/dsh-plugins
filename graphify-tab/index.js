/**
 * Host half of `@local/dsh-graphify`.
 *
 * Manages one graphify project per Session directory:
 *   - `GET /api/graphify.*` read routes for the Graph tab and the Dependencies
 *     settings page (status, explore payload, project tree, file dependencies,
 *     node/file detail, search, path, impact, report, externals, projects);
 *   - `POST /api/graphify.build` / `.cancel` for serialized local builds;
 *   - one `graphify` tool so agents can query the same graph the tab shows;
 *   - a short system-prompt hint that exists only once a graph is built.
 *
 * Code-only builds never send project content anywhere. External-dependency
 * verification reads manifests and (for npm) `node_modules`; manual decisions
 * are stored under `$DSH_HOME/graphify/settings.json`.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const GRAPH_DIR = 'graphify-out'
const GRAPH_FILE = 'graph.json'
const REPORT_FILE = 'GRAPH_REPORT.md'
const MANUAL_VERSION = 1
const MAX_OUTPUT_BYTES = 64 * 1024
const MAX_MANIFEST_BYTES = 256 * 1024
const MAX_REPORT_BYTES = 256 * 1024
const MAX_TREE_NODES = 60000
const DEFAULT_MAX_NODES = 600

const DEFAULT_CONFIG = {
  command: 'graphify',
  maxWorkers: 1,
  maxNodes: DEFAULT_MAX_NODES,
  promptHint: true,
  labelCommunities: true,
  buildTimeoutMs: 15 * 60 * 1000,
  toolWaitMs: 120 * 1000,
  cliTimeoutMs: 45 * 1000,
  scanExternals: true,
  maxScanFiles: 1500,
  maxScanBytes: 512 * 1024,
}

const DEP_RELATIONS = [
  'imports',
  'imports_from',
  'calls',
  'indirect_call',
  'instructs',
  'inherits',
  'extends',
  'implements',
  'uses',
  'references',
  'method',
  'mixes_in',
  'requires',
]
const DEP_RELATION_SET = new Set(DEP_RELATIONS)
const IMPORT_RELATIONS = new Set(['imports', 'imports_from', 'requires'])
const CODE_MANIFESTS = new Set([
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'requirements-dev.txt',
  'cargo.toml',
  'go.mod',
  'composer.json',
  'gemfile',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'pubspec.yaml',
])
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  '.next',
  '.nuxt',
  '.cache',
  '.graphify',
  'graphify-out',
])

/* ------------------------------------------------------------------ utils */

const text = (value) => (value === undefined || value === null ? '' : String(value))
const norm = (value) => text(value).replace(/\\/g, '/').replace(/^\.\//, '')
const lineNumber = (value) => {
  const match = /^L?(\d+)/i.exec(text(value))
  return match ? Number(match[1]) : 0
}
const idText = (value) => text(value)
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

function statusError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

function clamp(value, minimum, maximum, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.trunc(number), minimum), maximum)
}

function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function capText(value, limit = MAX_OUTPUT_BYTES) {
  const string = text(value)
  if (string.length <= limit) return string
  return `${string.slice(0, limit)}\n… (truncated)`
}

function splitLines(value) {
  return text(value)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.length > 0)
}

/* -------------------------------------------------------------- processes */

function runCapture(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20000
  return new Promise((resolvePromise, reject) => {
    let child
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(error)
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback(value)
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {}
      finish(reject, new Error(`command timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)
    child.stdout?.on('data', (chunk) => {
      stdout = capText(stdout + chunk.toString())
    })
    child.stderr?.on('data', (chunk) => {
      stderr = capText(stderr + chunk.toString())
    })
    child.on('error', (error) => finish(reject, error))
    child.on('close', (code) => finish(resolvePromise, { code, stdout, stderr }))
  })
}

function which(command) {
  if (!command || command.includes('/') || command.includes('\\')) {
    return existsSync(command) ? command : ''
  }
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  for (const dir of (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':')) {
    if (!dir) continue
    for (const extension of extensions) {
      const candidate = join(dir, `${command}${extension}`)
      if (existsSync(candidate)) return candidate
    }
  }
  return ''
}

/* -------------------------------------------------------- graph structure */

function buildModel(raw, root, labels) {
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : []
  const links = Array.isArray(raw?.links) ? raw.links : Array.isArray(raw?.edges) ? raw.edges : []
  const byId = new Map()
  const degree = new Map()
  const childrenOf = new Map()
  const containedBy = new Map()
  const fileMap = new Map()
  let extracted = 0
  let inferred = 0

  for (const node of nodes) {
    const id = idText(node?.id)
    if (!id) continue
    byId.set(id, node)
    const file = norm(node?.source_file)
    if (!file) continue
    let record = fileMap.get(file)
    if (!record) {
      record = { path: file, nodes: [], fileNode: null, roots: [] }
      fileMap.set(file, record)
    }
    record.nodes.push(node)
  }

  for (const link of links) {
    const source = idText(link?.source)
    const target = idText(link?.target)
    if (source) degree.set(source, (degree.get(source) || 0) + 1)
    if (target) degree.set(target, (degree.get(target) || 0) + 1)
    if (link?.confidence === 'EXTRACTED') extracted += 1
    else if (link?.confidence === 'INFERRED') inferred += 1
    if (link?.relation === 'contains' && source && target) {
      if (!childrenOf.has(source)) childrenOf.set(source, [])
      childrenOf.get(source).push(target)
      if (!containedBy.has(target)) containedBy.set(target, source)
    }
  }

  for (const record of fileMap.values()) {
    const name = basename(record.path)
    record.fileNode =
      record.nodes.find((node) => text(node?.label) === record.path) ||
      record.nodes.find((node) => text(node?.label) === name) ||
      record.nodes.find((node) => text(node?.label) === basename(record.path, extname(record.path))) ||
      null
    const ids = new Set(record.nodes.map((node) => idText(node?.id)))
    const fileNodeId = idText(record.fileNode?.id)
    record.roots = record.nodes.filter((node) => {
      const id = idText(node?.id)
      if (!id || id === fileNodeId) return false
      const parent = containedBy.get(id)
      // A containment edge from this file's own file-node is the normal
      // file -> symbol relationship; only a symbol's containment hides a
      // symbol from the file's root list.
      if (parent && parent !== fileNodeId && ids.has(parent)) return false
      return true
    })
    if (record.roots.length === 0) {
      record.roots = record.nodes.filter((node) => idText(node?.id) !== fileNodeId)
    }
  }

  const communities = new Map()
  for (const node of nodes) {
    const community = node?.community
    if (community === undefined || community === null) continue
    const key = idText(community)
    let record = communities.get(key)
    if (!record) {
      record = { id: community, count: 0, name: '' }
      communities.set(key, record)
    }
    record.count += 1
    if (!record.name && node?.community_name) record.name = text(node.community_name)
  }
  if (labels && typeof labels === 'object') {
    for (const [key, value] of Object.entries(labels)) {
      const record = communities.get(text(key))
      if (record && typeof value === 'string' && value) record.name = value
    }
  }

  const stats = {
    nodes: nodes.length,
    edges: links.length,
    files: fileMap.size,
    communities: communities.size,
    symbols: Math.max(0, nodes.length - fileMap.size),
    extracted,
    inferred,
  }

  const model = {
    root,
    raw,
    nodes,
    links,
    byId,
    degree,
    fileMap,
    childrenOf,
    containedBy,
    communities,
    stats,
    schemaVersion: raw?.graph?.schema_version ?? raw?.schema_version ?? null,
    graphifyVersion: raw?.graph?.graphify_version ?? raw?.graphify_version ?? null,
    depsCache: new Map(),
    tree: null,
    mtimeMs: 0,
    bytes: 0,
  }
  model.tree = buildTree(model)
  return model
}

function isManifestFile(path) {
  const name = basename(path).toLowerCase()
  return CODE_MANIFESTS.has(name) || /^requirements.*\.txt$/.test(name)
}

function sortedSymbolChildren(model, node, file, seen) {
  const ids = model.childrenOf.get(idText(node?.id)) || []
  const children = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const child = model.byId.get(id)
    if (!child) continue
    if (norm(child.source_file) !== file) continue
    if (text(child.id) === idText(node?.id)) continue
    seen.add(id)
    children.push(child)
  }
  return children.sort((a, b) => lineNumber(a.source_location) - lineNumber(b.source_location) || text(a.label).localeCompare(text(b.label)))
}

function symbolNode(model, node, file, depth, seen) {
  const id = idText(node?.id)
  const children = depth >= 4 ? [] : sortedSymbolChildren(model, node, file, seen).map((child) => symbolNode(model, child, file, depth + 1, seen))
  return {
    type: 'symbol',
    id,
    name: text(node?.label) || id,
    file,
    line: lineNumber(node?.source_location),
    community: node?.community ?? null,
    fileType: text(node?.file_type) || 'code',
    count: 1 + children.reduce((sum, child) => sum + child.count, 0),
    children,
  }
}

function buildSymbols(model, record) {
  const roots = record.roots
    .slice()
    .sort((a, b) => lineNumber(a.source_location) - lineNumber(b.source_location) || text(a.label).localeCompare(text(b.label)))
  const seen = new Set([idText(record.fileNode?.id)])
  const limited = roots.length > 250 ? roots.slice(0, 250) : roots
  const children = limited.map((node) => symbolNode(model, node, record.path, 0, seen))
  if (roots.length > limited.length) {
    children.push({
      type: 'symbol',
      id: '',
      name: `+${roots.length - limited.length} more`,
      file: record.path,
      line: 0,
      community: null,
      fileType: 'more',
      count: 1,
      children: [],
    })
  }
  return children
}

function finalizeTree(node, counter) {
  if (!node.children || node.children.length === 0) {
    counter.value += 1
    if (node.type === 'dir') node.count = 0
    else if (node.type === 'file') node.count = 1
    else node.count = node.count || 1
    return node.count
  }
  for (const child of node.children) finalizeTree(child, counter)
  node.children.sort((a, b) => {
    const rank = { dir: 0, file: 1, symbol: 2, more: 3 }
    const difference = (rank[a.type] ?? 4) - (rank[b.type] ?? 4)
    if (difference !== 0) return difference
    if (a.type === 'symbol' && b.type === 'symbol' && a.line && b.line && a.line !== b.line) return a.line - b.line
    return text(a.name).localeCompare(text(b.name))
  })
  const sum = node.children.reduce((total, child) => total + (child.count || 0), 0)
  node.count = node.type === 'dir' ? sum : 1 + sum
  return node.count
}

function buildTree(model) {
  const rootName = basename(model.root) || model.root
  const rootNode = { type: 'dir', name: rootName, path: '', count: 0, children: [] }
  const dirs = new Map([['', rootNode]])
  const total = { value: 0 }

  function ensureDir(dirPath) {
    if (!dirPath || dirPath === '.') return rootNode
    const parts = dirPath.split('/')
    let current = rootNode
    let accumulated = ''
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part
      let next = dirs.get(accumulated)
      if (!next) {
        next = { type: 'dir', name: part, path: accumulated, count: 0, children: [] }
        dirs.set(accumulated, next)
        current.children.push(next)
      }
      current = next
    }
    return current
  }

  for (const [file, record] of model.fileMap) {
    if (total.value >= MAX_TREE_NODES) break
    const parent = ensureDir(dirname(file) === '.' ? '' : dirname(file))
    const manifest = isManifestFile(file)
    const type = text(record.nodes.find((node) => node?.file_type)?.file_type) || 'code'
    const fileNode = {
      type: 'file',
      name: basename(file),
      path: file,
      nodeId: idText(record.fileNode?.id),
      fileType: type,
      manifest,
      count: 1,
      children: [],
    }
    if (!manifest) fileNode.children = buildSymbols(model, record)
    finalizeTree(fileNode, total)
    parent.children.push(fileNode)
    total.value += 1
  }

  finalizeTree(rootNode, total)
  return rootNode
}

/* ------------------------------------------------------------ exploration */

function communitiesPayload(model) {
  return [...model.communities.values()]
    .map((record) => ({ id: record.id, name: record.name || `Community ${record.id}`, count: record.count }))
    .sort((a, b) => b.count - a.count)
}

function explorePayload(model, maximum) {
  const limit = clamp(maximum, 50, 4000, DEFAULT_MAX_NODES)
  const candidates = model.nodes.filter((node) => text(node?.source_file) && text(node?.id))
  const ranked = candidates
    .slice()
    .sort((a, b) => (model.degree.get(idText(b.id)) || 0) - (model.degree.get(idText(a.id)) || 0))
  const kept = ranked.slice(0, limit)
  const ids = new Set(kept.map((node) => idText(node.id)))
  const edges = []
  for (const link of model.links) {
    const source = idText(link?.source)
    const target = idText(link?.target)
    if (!ids.has(source) || !ids.has(target)) continue
    edges.push({
      source,
      target,
      relation: text(link?.relation) || 'related',
      confidence: text(link?.confidence) || 'EXTRACTED',
      context: text(link?.context || ''),
    })
  }
  return {
    nodes: kept.map((node) => ({
      id: idText(node.id),
      label: text(node.label) || idText(node.id),
      file: norm(node.source_file),
      line: lineNumber(node.source_location),
      community: node.community ?? null,
      communityName: text(node.community_name || model.communities.get(idText(node.community))?.name || ''),
      type: text(node.file_type) || 'code',
      degree: model.degree.get(idText(node.id)) || 0,
    })),
    edges,
    communities: communitiesPayload(model),
    total: candidates.length,
    shown: kept.length,
  }
}

function nodeDetail(model, id) {
  const node = model.byId.get(text(id))
  if (!node) throw statusError('node not found', 404)
  const neighbors = []
  for (const link of model.links) {
    const source = idText(link?.source)
    const target = idText(link?.target)
    let otherId = ''
    let direction = ''
    if (source === text(id)) {
      otherId = target
      direction = 'out'
    } else if (target === text(id)) {
      otherId = source
      direction = 'in'
    } else {
      continue
    }
    const other = model.byId.get(otherId)
    neighbors.push({
      direction,
      relation: text(link?.relation) || 'related',
      confidence: text(link?.confidence) || 'EXTRACTED',
      context: text(link?.context || ''),
      node: {
        id: otherId,
        label: text(other?.label) || otherId,
        file: norm(other?.source_file),
        line: lineNumber(other?.source_location),
        type: text(other?.file_type) || 'code',
      },
    })
    if (neighbors.length >= 120) break
  }
  const groups = new Map()
  for (const neighbor of neighbors) {
    if (!groups.has(neighbor.relation)) groups.set(neighbor.relation, [])
    groups.get(neighbor.relation).push(neighbor)
  }
  return {
    kind: 'node',
    id: idText(node.id),
    label: text(node.label) || idText(node.id),
    file: norm(node.source_file),
    line: lineNumber(node.source_location),
    type: text(node.file_type) || 'code',
    community: node.community ?? null,
    communityName: text(node.community_name || model.communities.get(idText(node.community))?.name || ''),
    degree: model.degree.get(idText(node.id)) || 0,
    neighbors,
    groups: [...groups.entries()].map(([relation, items]) => ({ relation, items })),
  }
}

function fileDetail(model, path) {
  const file = norm(path)
  const record = model.fileMap.get(file)
  if (!record) throw statusError('file not found in the graph', 404)
  const deps = depsFor(model, 'file')
  const incoming = deps.edges.filter((edge) => edge.target === file)
  const outgoing = deps.edges.filter((edge) => edge.source === file)
  const symbols = record.nodes
    .filter((node) => idText(node?.id) !== idText(record.fileNode?.id))
    .sort((a, b) => lineNumber(a.source_location) - lineNumber(b.source_location))
    .slice(0, 250)
    .map((node) => ({
      id: idText(node.id),
      label: text(node.label) || idText(node.id),
      line: lineNumber(node.source_location),
      community: node.community ?? null,
      type: text(node.file_type) || 'code',
    }))
  const community = record.nodes.find((node) => node?.community !== undefined && node?.community !== null)?.community ?? null
  return {
    kind: 'file',
    path: file,
    name: basename(file),
    nodeId: idText(record.fileNode?.id),
    manifest: isManifestFile(file),
    community,
    fanIn: incoming.length,
    fanOut: outgoing.length,
    symbols,
    incoming,
    outgoing,
    cycles: deps.cycles.filter((cycle) => cycle.includes(file)),
  }
}

function searchPayload(model, query, limit) {
  const needle = text(query).trim().toLowerCase()
  if (!needle) return { query: '', results: [] }
  const results = []
  for (const node of model.nodes) {
    const label = text(node?.label)
    const file = norm(node?.source_file)
    if (!label && !file) continue
    const lowerLabel = label.toLowerCase()
    const lowerFile = file.toLowerCase()
    if (!lowerLabel.includes(needle) && !lowerFile.includes(needle)) continue
    let score = 0
    if (lowerLabel === needle) score += 100
    else if (lowerLabel.startsWith(needle)) score += 60
    else if (lowerLabel.includes(needle)) score += 30
    if (lowerFile === needle) score += 80
    else if (lowerFile.startsWith(needle)) score += 40
    else if (lowerFile.includes(needle)) score += 20
    score += Math.min(20, model.degree.get(idText(node.id)) || 0)
    results.push({
      kind: 'node',
      id: idText(node.id),
      label: label || idText(node.id),
      file,
      line: lineNumber(node.source_location),
      community: node.community ?? null,
      type: text(node.file_type) || 'code',
      score,
    })
  }
  const files = new Set()
  for (const [file, record] of model.fileMap) {
    if (!file.toLowerCase().includes(needle)) continue
    files.add(file)
    if (file.toLowerCase() === needle) {
      results.push({
        kind: 'file',
        id: `file:${file}`,
        label: basename(file),
        file,
        line: 0,
        community: record.nodes.find((node) => node?.community !== undefined)?.community ?? null,
        type: 'file',
        score: 90,
      })
    }
  }
  results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  const unique = []
  const seen = new Set()
  for (const result of results) {
    const key = result.kind === 'file' ? result.file : result.id
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(result)
    if (unique.length >= clamp(limit, 1, 100, 40)) break
  }
  return { query: text(query), results: unique }
}

function nodePath(model, from, to) {
  const source = text(from)
  const target = text(to)
  if (!model.byId.has(source)) throw statusError('source node not found', 404)
  if (!model.byId.has(target)) throw statusError('target node not found', 404)
  if (source === target) return { found: true, hops: [] }
  const adjacency = new Map()
  for (const link of model.links) {
    const s = idText(link?.source)
    const t = idText(link?.target)
    if (!s || !t) continue
    if (!adjacency.has(s)) adjacency.set(s, [])
    adjacency.get(s).push({ id: t, relation: text(link?.relation), confidence: text(link?.confidence), context: text(link?.context || '') })
  }
  const parent = new Map([[source, null]])
  const queue = [source]
  let found = false
  while (queue.length > 0 && parent.size < 30000) {
    const current = queue.shift()
    if (current === target) {
      found = true
      break
    }
    for (const edge of adjacency.get(current) || []) {
      if (parent.has(edge.id)) continue
      parent.set(edge.id, { from: current, edge })
      queue.push(edge.id)
    }
  }
  if (!found) return { found: false, hops: [] }
  const hops = []
  let cursor = target
  while (parent.get(cursor)) {
    const step = parent.get(cursor)
    const fromNode = model.byId.get(step.from)
    const toNode = model.byId.get(cursor)
    hops.unshift({
      from: { id: step.from, label: text(fromNode?.label) || step.from, file: norm(fromNode?.source_file), line: lineNumber(fromNode?.source_location) },
      to: { id: cursor, label: text(toNode?.label) || cursor, file: norm(toNode?.source_file), line: lineNumber(toNode?.source_location) },
      relation: step.edge.relation,
      confidence: step.edge.confidence,
      context: step.edge.context,
    })
    cursor = step.from
  }
  return { found: true, hops }
}

/* ------------------------------------------------------------- dependency */

function folderOf(file) {
  const normalized = norm(file)
  const directory = dirname(normalized)
  return directory === '.' || directory === '' ? '(root)' : directory
}

function tarjan(nodes, adjacency) {
  let index = 0
  const stack = []
  const onStack = new Set()
  const indices = new Map()
  const low = new Map()
  const components = []
  const strong = (node) => {
    indices.set(node, index)
    low.set(node, index)
    index += 1
    stack.push(node)
    onStack.add(node)
    for (const next of adjacency.get(node) || []) {
      if (!indices.has(next)) {
        strong(next)
        low.set(node, Math.min(low.get(node), low.get(next)))
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), indices.get(next)))
      }
    }
    if (low.get(node) === indices.get(node)) {
      const component = []
      while (true) {
        const member = stack.pop()
        onStack.delete(member)
        component.push(member)
        if (member === node) break
      }
      components.push(component)
    }
  }
  for (const node of nodes) {
    if (!indices.has(node)) strong(node)
  }
  return components
}

function depsFor(model, level) {
  const key = level === 'folder' ? 'folder' : 'file'
  if (model.depsCache.has(key)) return model.depsCache.get(key)
  const mapped = (file) => (key === 'folder' ? folderOf(file) : norm(file))
  const nodes = new Map()
  const addNode = (id, file) => {
    let record = nodes.get(id)
    if (!record) {
      record = { id, label: id, type: key, fanIn: 0, fanOut: 0, community: null, communityCounts: new Map(), files: 0, cycle: null }
      nodes.set(id, record)
    }
    if (file) {
      record.files += 1
      const source = model.fileMap.get(file)
      const community = source?.nodes.find((node) => node?.community !== undefined && node?.community !== null)?.community
      if (community !== undefined && community !== null) {
        const count = record.communityCounts.get(community) || 0
        record.communityCounts.set(community, count + 1)
      }
    }
    return record
  }
  for (const file of model.fileMap.keys()) addNode(mapped(file), file)

  const pairs = new Map()
  const relationCounts = {}
  for (const link of model.links) {
    const relation = text(link?.relation)
    if (!DEP_RELATION_SET.has(relation)) continue
    const sourceNode = model.byId.get(idText(link?.source))
    const targetNode = model.byId.get(idText(link?.target))
    const sourceFile = norm(sourceNode?.source_file)
    const targetFile = norm(targetNode?.source_file)
    if (!sourceFile || !targetFile) continue
    // Manifest entries belong to the external-dependency settings page, not
    // the code architecture view; graphify can also resolve `files` entries
    // across sibling packages, which would distort the graph.
    if (isManifestFile(sourceFile) || isManifestFile(targetFile)) continue
    relationCounts[relation] = (relationCounts[relation] || 0) + 1
    const source = mapped(sourceFile)
    const target = mapped(targetFile)
    if (source === target) continue
    addNode(source, sourceFile)
    addNode(target, targetFile)
    const pairKey = `${source}\u0000${target}`
    let edge = pairs.get(pairKey)
    if (!edge) {
      edge = {
        source,
        target,
        relations: {},
        confidence: 'INFERRED',
        count: 0,
        evidence: [],
        extracted: 0,
      }
      pairs.set(pairKey, edge)
    }
    edge.relations[relation] = (edge.relations[relation] || 0) + 1
    edge.count += 1
    if (link?.confidence === 'EXTRACTED') {
      edge.extracted += 1
      edge.confidence = 'EXTRACTED'
    }
    if (edge.evidence.length < 3) {
      edge.evidence.push({
        sourceId: idText(sourceNode?.id),
        targetId: idText(targetNode?.id),
        file: sourceFile,
        line: lineNumber(sourceNode?.source_location),
        label: text(sourceNode?.label),
        relation,
        toLabel: text(targetNode?.label),
        toFile: targetFile,
        toLine: lineNumber(targetNode?.source_location),
        confidence: text(link?.confidence) || 'EXTRACTED',
        context: text(link?.context || ''),
      })
    }
  }

  // External imports are not file-to-file edges, but they are real
  // dependencies. Scan-derived records connect a file/folder to an external
  // node so the Dependencies view is not a field of isolated files.
  for (const record of model.externalImports || []) {
    const source = mapped(record.file)
    if (!nodes.has(source)) addNode(source, record.file)
    const externalId = `ext:${record.name}`
    let external = nodes.get(externalId)
    if (!external) {
      external = {
        id: externalId,
        label: record.name,
        type: 'external',
        fanIn: 0,
        fanOut: 0,
        community: null,
        communityCounts: new Map(),
        files: 0,
        cycle: null,
        ecosystem: record.ecosystem,
        importers: new Set(),
      }
      nodes.set(externalId, external)
    }
    external.importers.add(record.file)
    const pairKey = `${source}\u0000${externalId}`
    let edge = pairs.get(pairKey)
    if (!edge) {
      edge = {
        source,
        target: externalId,
        relations: {},
        confidence: 'EXTRACTED',
        count: 0,
        evidence: [],
        extracted: 0,
        external: true,
      }
      pairs.set(pairKey, edge)
    }
    edge.relations.imports = (edge.relations.imports || 0) + 1
    edge.count += 1
    edge.extracted += 1
    relationCounts.imports = (relationCounts.imports || 0) + 1
    if (edge.evidence.length < 3) {
      edge.evidence.push({
        sourceId: '',
        targetId: externalId,
        file: record.file,
        line: record.line,
        label: basename(record.file),
        relation: 'imports',
        toLabel: record.name,
        toFile: '',
        toLine: 0,
        confidence: 'EXTRACTED',
        context: 'import',
      })
    }
  }

  const edges = [...pairs.values()].sort((a, b) => b.count - a.count)
  const adjacency = new Map()
  const reverse = new Map()
  const importAdjacency = new Map()
  for (const edge of edges) {
    adjacency.set(edge.source, (adjacency.get(edge.source) || 0) + 1)
    reverse.set(edge.target, (reverse.get(edge.target) || 0) + 1)
    const sourceNode = nodes.get(edge.source)
    const targetNode = nodes.get(edge.target)
    if (sourceNode) {
      sourceNode.fanOut += 1
      if (!importAdjacency.has(edge.source)) importAdjacency.set(edge.source, [])
      if (hasOwn(edge.relations, 'imports') || hasOwn(edge.relations, 'imports_from') || hasOwn(edge.relations, 'requires')) {
        importAdjacency.get(edge.source).push(edge.target)
      }
    }
    if (targetNode) targetNode.fanIn += 1
  }

  const components = tarjan([...nodes.keys()], importAdjacency)
  const cycles = []
  for (const component of components) {
    if (component.length < 2) continue
    cycles.push(component)
  }
  cycles.forEach((cycle, index) => {
    for (const id of cycle) {
      const record = nodes.get(id)
      if (record) record.cycle = index
    }
  })

  const nodeList = [...nodes.values()].map((record) => {
    let topCommunity = null
    let topCount = -1
    for (const [community, count] of record.communityCounts) {
      if (count > topCount) {
        topCount = count
        topCommunity = community
      }
    }
    return {
      id: record.id,
      label: record.label,
      type: record.type,
      fanIn: record.fanIn,
      fanOut: record.fanOut,
      community: topCommunity,
      files: record.files,
      cycle: record.cycle,
      ecosystem: record.ecosystem || null,
      importers: record.importers ? [...record.importers].slice(0, 12) : [],
    }
  })
  nodeList.sort((a, b) => b.fanIn + b.fanOut - (a.fanIn + a.fanOut) || a.label.localeCompare(b.label))

  const topIn = nodeList
    .filter((node) => node.fanIn > 0)
    .slice()
    .sort((a, b) => b.fanIn - a.fanIn)
    .slice(0, 12)
    .map((node) => ({ id: node.id, label: node.label, count: node.fanIn }))
  const topOut = nodeList
    .filter((node) => node.fanOut > 0)
    .slice()
    .sort((a, b) => b.fanOut - a.fanOut)
    .slice(0, 12)
    .map((node) => ({ id: node.id, label: node.label, count: node.fanOut }))
  const orphans = nodeList.filter((node) => node.fanIn === 0 && node.fanOut === 0).slice(0, 50).map((node) => node.id)

  const externalMap = new Map()
  for (const record of model.externalImports || []) {
    let entry = externalMap.get(record.name)
    if (!entry) {
      entry = { name: record.name, count: 0, importers: new Set() }
      externalMap.set(record.name, entry)
    }
    entry.count += 1
    entry.importers.add(record.file)
  }
  for (const link of model.links) {
    const relation = text(link?.relation)
    if (!IMPORT_RELATIONS.has(relation)) continue
    const sourceNode = model.byId.get(idText(link?.source))
    const targetNode = model.byId.get(idText(link?.target))
    if (!targetNode || norm(targetNode.source_file)) continue
    const name = text(targetNode.label || targetNode.id)
    if (!name) continue
    let record = externalMap.get(name)
    if (!record) {
      record = { name, count: 0, importers: new Set() }
      externalMap.set(name, record)
    }
    record.count += 1
    if (sourceNode && norm(sourceNode.source_file)) record.importers.add(norm(sourceNode.source_file))
  }
  const external = [...externalMap.values()]
    .map((record) => ({ name: record.name, count: record.count, importers: [...record.importers].slice(0, 8) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 80)

  const payload = {
    level: key,
    nodes: nodeList,
    edges,
    cycles,
    topIn,
    topOut,
    orphans,
    external,
    relationCounts,
    stats: {
      nodes: nodeList.length,
      edges: edges.length,
      cycles: cycles.length,
      files: model.fileMap.size,
      external: external.length,
    },
  }
  model.depsCache.set(key, payload)
  return payload
}

function fileImpact(model, file, depth) {
  const target = norm(file)
  const deps = depsFor(model, 'file')
  if (!model.fileMap.has(target)) throw statusError('file not found in the graph', 404)
  const reverse = new Map()
  for (const edge of deps.edges) {
    if (!reverse.has(edge.target)) reverse.set(edge.target, [])
    reverse.get(edge.target).push(edge)
  }
  const maximum = clamp(depth, 1, 6, 2)
  const visited = new Map([[target, 0]])
  const queue = [target]
  const paths = []
  while (queue.length > 0) {
    const current = queue.shift()
    const distance = visited.get(current)
    if (distance >= maximum) continue
    for (const edge of reverse.get(current) || []) {
      if (visited.has(edge.source)) continue
      visited.set(edge.source, distance + 1)
      paths.push({
        file: edge.source,
        distance: distance + 1,
        via: current,
        relations: Object.keys(edge.relations),
        count: edge.count,
        confidence: edge.confidence,
      })
      queue.push(edge.source)
    }
  }
  paths.sort((a, b) => a.distance - b.distance || a.file.localeCompare(b.file))
  return { file: target, depth: maximum, files: paths.slice(0, 400), total: paths.length }
}

/* ------------------------------------------------------------- manifests */

async function readTextLimited(path, limit = MAX_MANIFEST_BYTES) {
  const info = await stat(path)
  if (!info.isFile() || info.size > limit) return ''
  return readFile(path, 'utf8')
}

function dependencyEntry(name, range, section) {
  const clean = text(name).trim()
  if (!clean || clean.startsWith('-') || clean.startsWith('#')) return null
  return { name: clean, range: text(range).trim(), section: text(section) }
}

function parsePackageJson(content) {
  let data
  try {
    data = JSON.parse(content)
  } catch {
    return []
  }
  const output = []
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const group = data?.[section]
    if (!group || typeof group !== 'object') continue
    for (const [name, range] of Object.entries(group)) {
      const entry = dependencyEntry(name, typeof range === 'string' ? range : '', section)
      if (entry) output.push(entry)
    }
  }
  return output
}

function parseRequirementLine(line) {
  let spec = text(line).split(';')[0].split('#')[0].trim()
  if (!spec || spec.startsWith('-') || spec.startsWith('git+') || spec.startsWith('http')) return null
  const match = /^([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*(.*)$/.exec(spec)
  if (!match) return null
  return { name: match[1], range: text(match[2]).replace(/^[=<>!~]+\s*/, ''), section: 'requirements' }
}

function parseRequirements(content) {
  const output = []
  for (const line of text(content).split(/\r?\n/)) {
    const entry = parseRequirementLine(line)
    if (entry) output.push(entry)
  }
  return output
}

function parsePyproject(content) {
  const output = []
  const seen = new Set()
  const push = (entry) => {
    if (!entry) return
    const key = entry.name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    output.push(entry)
  }
  const block = /^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m.exec(content)
  if (block) {
    for (const line of block[1].split(/\r?\n/)) {
      // Comments inside a TOML dependency array often contain quoted prose;
      // strip them before reading the quoted requirement strings.
      const clean = line.replace(/#.*$/, '')
      for (const match of clean.matchAll(/["']([^"']+)["']/g)) {
        const entry = parseRequirementLine(match[1])
        if (entry) push({ ...entry, section: 'dependencies' })
      }
    }
  }
  const poetry = /\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/.exec(content)
  if (poetry) {
    for (const line of poetry[1].split(/\r?\n/)) {
      const match = /^\s*([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line)
      if (!match || match[1].toLowerCase() === 'python') continue
      push({ name: match[1], range: text(match[2]).replace(/^["']|["']$/g, ''), section: 'poetry' })
    }
  }
  return output
}

function parseCargo(content) {
  const output = []
  const section = /\[(?:dev-|build-)?dependencies\]([\s\S]*?)(?=\n\[|$)/.exec(content)
  if (!section) return output
  for (const line of section[1].split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line)
    if (!match) continue
    const range = /version\s*=\s*"([^"]+)"/.exec(match[2])?.[1] || text(match[2]).replace(/^["']|["']$/g, '')
    output.push({ name: match[1], range, section: 'dependencies' })
  }
  return output
}

function parseGoMod(content) {
  const output = []
  const seen = new Set()
  const push = (name, version) => {
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    output.push({ name, range: version, section: 'require' })
  }
  let inBlock = false
  for (const line of text(content).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('require (')) {
      inBlock = true
      continue
    }
    if (inBlock && trimmed === ')') {
      inBlock = false
      continue
    }
    const match = inBlock
      ? /^([A-Za-z0-9_./-]+)\s+(v[^\s]+)/.exec(trimmed)
      : /^require\s+([A-Za-z0-9_./-]+)\s+(v[^\s]+)/.exec(trimmed)
    if (match) push(match[1], match[2])
  }
  return output
}

function parseComposer(content) {
  let data
  try {
    data = JSON.parse(content)
  } catch {
    return []
  }
  const output = []
  for (const section of ['require', 'require-dev']) {
    const group = data?.[section]
    if (!group || typeof group !== 'object') continue
    for (const [name, range] of Object.entries(group)) {
      if (name === 'php' || name.startsWith('ext-')) continue
      const entry = dependencyEntry(name, range, section)
      if (entry) output.push(entry)
    }
  }
  return output
}

function globToRegExp(pattern) {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${escaped}(/|$)`)
}

async function readIgnorePatterns(root) {
  const patterns = []
  try {
    const content = await readFile(join(root, '.graphifyignore'), 'utf8')
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#') || line.startsWith('!')) continue
      patterns.push(line.replace(/^\/+/, '').replace(/\/+$/, ''))
    }
  } catch {}
  return patterns
}

function ignoredPath(relativePath, patterns) {
  const path = norm(relativePath)
  return patterns.some((pattern) => {
    if (!pattern) return false
    if (pattern.includes('*')) return globToRegExp(pattern).test(path)
    return path === pattern || path.startsWith(`${pattern}/`) || path.split('/').includes(pattern)
  })
}

async function scanManifests(root) {
  const manifests = []
  const patterns = await readIgnorePatterns(root)
  const queue = [{ dir: root, depth: 0 }]
  while (queue.length > 0 && manifests.length < 160) {
    const current = queue.shift()
    if (current.depth > 4) continue
    let entries
    try {
      entries = await readdir(current.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        const child = join(current.dir, entry.name)
        if (ignoredPath(relative(root, child), patterns)) continue
        queue.push({ dir: child, depth: current.depth + 1 })
        continue
      }
      if (!entry.isFile()) continue
      const name = entry.name.toLowerCase()
      let ecosystem = ''
      if (name === 'package.json') ecosystem = 'npm'
      else if (name === 'pyproject.toml') ecosystem = 'python'
      else if (/^requirements.*\.txt$/.test(name)) ecosystem = 'python'
      else if (name === 'cargo.toml') ecosystem = 'rust'
      else if (name === 'go.mod') ecosystem = 'go'
      else if (name === 'composer.json') ecosystem = 'php'
      if (!ecosystem) continue
      const absolute = join(current.dir, entry.name)
      if (ignoredPath(relative(root, absolute), patterns)) continue
      let content = ''
      try {
        content = await readTextLimited(absolute)
      } catch {
        continue
      }
      let deps = []
      if (ecosystem === 'npm') deps = parsePackageJson(content)
      else if (ecosystem === 'python' && name === 'pyproject.toml') deps = parsePyproject(content)
      else if (ecosystem === 'python') deps = parseRequirements(content)
      else if (ecosystem === 'rust') deps = parseCargo(content)
      else if (ecosystem === 'go') deps = parseGoMod(content)
      else if (ecosystem === 'php') deps = parseComposer(content)
      manifests.push({
        path: norm(relative(root, absolute)),
        dir: current.dir,
        ecosystem,
        deps,
      })
    }
  }
  return manifests
}

function manualKey(ecosystem, name) {
  return `${text(ecosystem).toLowerCase()}:${text(name).toLowerCase()}`
}

async function npmInstalledVersion(manifestDir, name) {
  const file = join(manifestDir, 'node_modules', ...text(name).split('/'), 'package.json')
  try {
    const data = JSON.parse(await readFile(file, 'utf8'))
    return text(data?.version) || 'installed'
  } catch {
    return ''
  }
}

async function collectExternals(root, manual, graphModel) {
  const manifests = await scanManifests(root)
  const entries = new Map()
  for (const manifest of manifests) {
    const nodeModules = existsSync(join(manifest.dir, 'node_modules'))
    for (const dep of manifest.deps) {
      const key = manualKey(manifest.ecosystem, dep.name)
      if (entries.has(key)) continue
      let installed = ''
      if (manifest.ecosystem === 'npm') installed = await npmInstalledVersion(manifest.dir, dep.name)
      entries.set(key, {
        key,
        name: dep.name,
        ecosystem: manifest.ecosystem,
        range: dep.range,
        section: dep.section,
        manifest: manifest.path,
        manifestDir: manifest.dir,
        nodeModules,
        installed,
        declared: true,
        usage: 0,
        importers: [],
      })
    }
  }

  // Unresolved import stubs the graph recorded live under `runtime` unless a
  // manifest already declares the same package name.
  const graph = graphModel
  if (graph) {
    const deps = depsFor(graph, 'file')
    for (const external of deps.external) {
      // Node builtins are runtime primitives, not manageable third-party
      // dependencies; keep them in the dependency graph but out of Settings.
      if (external.name.startsWith('node:')) continue
      const existing = [...entries.values()].find((entry) => entry.name.toLowerCase() === external.name.toLowerCase())
      if (existing) {
        existing.usage = external.count
        existing.importers = external.importers
        continue
      }
      const key = manualKey('runtime', external.name)
      entries.set(key, {
        key,
        name: external.name,
        ecosystem: 'runtime',
        range: '',
        section: 'unresolved import',
        manifest: '',
        manifestDir: root,
        nodeModules: false,
        installed: '',
        declared: false,
        usage: external.count,
        importers: external.importers,
      })
    }
  }

  const project = manual?.projects?.[root] || {}
  for (const custom of Array.isArray(project.custom) ? project.custom : []) {
    if (!custom || !text(custom.name)) continue
    const key = manualKey(custom.ecosystem || 'manual', custom.name)
    if (entries.has(key)) continue
    entries.set(key, {
      key,
      name: text(custom.name),
      ecosystem: text(custom.ecosystem) || 'manual',
      range: text(custom.range),
      section: 'manual',
      manifest: '',
      manifestDir: root,
      nodeModules: false,
      installed: '',
      declared: false,
      usage: 0,
      importers: [],
      custom: true,
    })
  }

  const deps = [...entries.values()].map((entry) => {
    const override = project.deps?.[entry.key] || null
    let status = 'declared'
    if (entry.installed) status = 'installed'
    else if (entry.ecosystem === 'npm' && entry.nodeModules) status = 'missing'
    if (!entry.declared && entry.usage > 0) status = 'unresolved'
    if (entry.custom) status = 'declared'
    if (override?.status === 'verified') status = 'verified'
    else if (override?.status === 'ignored') status = 'ignored'
    return {
      key: entry.key,
      name: entry.name,
      ecosystem: entry.ecosystem,
      range: entry.range,
      section: entry.section,
      manifest: entry.manifest,
      installed: entry.installed,
      status,
      declared: entry.declared,
      custom: Boolean(entry.custom),
      usage: entry.usage,
      importers: entry.importers,
      note: text(override?.note || ''),
      verifiedAt: override?.verifiedAt || null,
    }
  })
  const rank = { missing: 0, unresolved: 1, declared: 2, installed: 3, verified: 4, ignored: 5 }
  deps.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name))
  return {
    manifests: manifests.map((manifest) => ({
      path: manifest.path,
      ecosystem: manifest.ecosystem,
      count: manifest.deps.length,
    })),
    deps,
  }
}

/* --------------------------------------------------------------- settings */

function manualPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'graphify', 'settings.json')
}

async function readManual() {
  try {
    const data = JSON.parse(await readFile(manualPath(), 'utf8'))
    if (!data || typeof data !== 'object') return { version: MANUAL_VERSION, projects: {} }
    if (!data.projects || typeof data.projects !== 'object') data.projects = {}
    return data
  } catch {
    return { version: MANUAL_VERSION, projects: {} }
  }
}

async function writeManual(data) {
  const file = manualPath()
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(temporary, file)
}

/* --------------------------------------------------- external import scan */

const SCAN_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py'])

function lineAt(content, index) {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content.charCodeAt(cursor) === 10) line += 1
  }
  return line
}

function normalizeImportName(specifier, extension) {
  const raw = text(specifier).trim()
  if (!raw || raw.startsWith('.') || raw.startsWith('/') || raw.startsWith('#')) return ''
  if (extension === '.py') return raw.split('.')[0]
  if (raw.startsWith('node:')) return raw
  if (raw.startsWith('@')) {
    const parts = raw.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : raw
  }
  return raw.split('/')[0]
}

function importRecordsFor(content, extension) {
  const records = []
  const seen = new Set()
  const push = (specifier, index) => {
    const name = normalizeImportName(specifier, extension)
    if (!name || seen.has(name)) return
    seen.add(name)
    records.push({
      name,
      line: lineAt(content, index),
      ecosystem: name.startsWith('node:') ? 'node' : extension === '.py' ? 'python' : 'npm',
    })
  }
  if (extension === '.py') {
    for (const match of content.matchAll(/^\s*import\s+([^\n#]+)/gm)) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim()
        if (name) push(name, match.index + match[0].indexOf(match[1]))
      }
    }
    for (const match of content.matchAll(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\b/gm)) {
      push(match[1], match.index)
    }
    return records
  }
  const patterns = [
    /(?:^|[^\w$])(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"\n]+)['"]/g,
    /(?:^|[^\w$])require\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /(?:^|[^\w$])import\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      push(match[1], match.index)
    }
  }
  return records
}

async function scanExternalImports(model, limits) {
  const files = [...model.fileMap.keys()]
    .filter((file) => SCAN_EXTENSIONS.has(extname(file).toLowerCase()))
    .slice(0, limits.maxFiles)
  const records = []
  for (const file of files) {
    const absolute = resolve(model.root, file)
    if (!isInside(model.root, absolute)) continue
    try {
      const info = await stat(absolute)
      if (!info.isFile() || info.size > limits.maxBytes) continue
      const content = await readFile(absolute, 'utf8')
      for (const record of importRecordsFor(content, extname(file).toLowerCase())) {
        records.push({ file, ...record })
      }
    } catch {}
  }
  return records
}

/* ------------------------------------------------------------------ plugin */

export const inject = ['connection', 'tools', 'sessions', 'systemPrompt']

export function apply(ctx, rowConfig) {
  const config = { ...DEFAULT_CONFIG, ...(rowConfig && typeof rowConfig === 'object' ? rowConfig : {}) }
  const jobs = new Map()
  const graphCache = new Map()
  const binaryCache = { at: 0, value: null }
  let manualQueue = Promise.resolve()

  const graphPaths = (root) => ({
    dir: join(root, GRAPH_DIR),
    graph: join(root, GRAPH_DIR, GRAPH_FILE),
    report: join(root, GRAPH_DIR, REPORT_FILE),
  })

  function sessionRoot(sessionId) {
    try {
      const session = ctx.sessions.get(text(sessionId))
      return text(session?.header?.cwd)
    } catch {
      return ''
    }
  }

  function allRoots(sessionId) {
    const roots = new Set()
    const session = sessionRoot(sessionId)
    if (session) roots.add(resolve(session))
    try {
      const registry = ctx.get?.('workspaceRegistry')
      for (const workspace of registry?.list?.() || []) {
        if (workspace?.path) roots.add(resolve(workspace.path))
      }
    } catch {}
    try {
      const directory = ctx.get?.('workingDirectory')?.defaultDirectory
      if (directory) roots.add(resolve(directory))
    } catch {}
    return [...roots]
  }

  function resolveProject(sessionId, rootParameter) {
    const session = sessionRoot(sessionId)
    const roots = allRoots(sessionId)
    let root = session || roots[0] || process.cwd()
    const requested = text(rootParameter).trim()
    if (requested) {
      const absolute = resolve(requested)
      if (!roots.some((candidate) => isInside(candidate, absolute))) {
        throw statusError('project root is outside the registered workspaces', 403)
      }
      if (!existsSync(absolute)) throw statusError('project root does not exist', 404)
      root = absolute
    }
    return { root: resolve(root), sessionRoot: session ? resolve(session) : '' }
  }

  function resolveWorkspaceRoot(rootParameter) {
    const roots = allRoots('')
    const requested = text(rootParameter).trim()
    if (requested) {
      const absolute = resolve(requested)
      if (!roots.some((candidate) => isInside(candidate, absolute))) {
        throw statusError('project root is outside the registered workspaces', 403)
      }
      if (!existsSync(absolute)) throw statusError('project root does not exist', 404)
      return absolute
    }
    if (roots[0]) return roots[0]
    throw statusError('no project root is available', 400)
  }

  /* ----------------------------------------------------------- binary/CLI */

  async function resolveBinary(force = false) {
    if (!force && binaryCache.value && Date.now() - binaryCache.at < 60_000) return binaryCache.value
    const candidates = []
    if (config.command) candidates.push(config.command)
    if (process.platform !== 'win32') candidates.push(join(homedir(), '.local', 'bin', 'graphify'))
    candidates.push('graphify')
    const seen = new Set()
    for (const candidate of candidates) {
      const path = candidate.includes('/') || candidate.includes('\\') ? (existsSync(candidate) ? candidate : '') : which(candidate)
      if (!path || seen.has(path)) continue
      seen.add(path)
      try {
        const result = await runCapture(path, ['--version'], { timeoutMs: 8000 })
        if (result.code !== 0) continue
        const output = text(result.stdout).trim()
        const match = /graphify\s+(\d+\.\d+\.\d+[^\s]*)/i.exec(output)
        const value = { path, version: match ? match[1] : output.split(/\r?\n/)[0] }
        binaryCache.at = Date.now()
        binaryCache.value = value
        return value
      } catch {}
    }
    const value = { path: '', version: '' }
    binaryCache.at = Date.now()
    binaryCache.value = value
    return value
  }

  async function runCli(root, args, timeoutMs = config.cliTimeoutMs) {
    const binary = await resolveBinary()
    if (!binary.path) {
      throw statusError('graphify CLI not found. Install it with: uv tool install graphifyy', 503)
    }
    const result = await runCapture(binary.path, [...args, '--graph', graphPaths(root).graph], {
      cwd: root,
      timeoutMs,
    })
    if (result.code !== 0) {
      const detail = splitLines(result.stderr).slice(-6).join('\n') || splitLines(result.stdout).slice(-6).join('\n')
      throw statusError(detail || `graphify exited with code ${result.code}`, 500)
    }
    return text(result.stdout).trim()
  }

  /* ------------------------------------------------------------- graph I/O */

  async function loadGraph(root) {
    const paths = graphPaths(root)
    const info = await stat(paths.graph)
    const cached = graphCache.get(root)
    if (cached && cached.model && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.model
    const raw = JSON.parse(await readFile(paths.graph, 'utf8'))
    let labels = null
    try {
      const parsed = JSON.parse(await readFile(join(paths.dir, '.graphify_labels.json'), 'utf8'))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) labels = parsed
    } catch {}
    const model = buildModel(raw, root, labels)
    model.mtimeMs = Math.round(info.mtimeMs)
    model.bytes = info.size
    if (config.scanExternals !== false) {
      try {
        model.externalImports = await scanExternalImports(model, {
          maxFiles: clamp(config.maxScanFiles, 0, 20000, 1500),
          maxBytes: clamp(config.maxScanBytes, 4096, 4 * 1024 * 1024, 512 * 1024),
        })
      } catch {
        model.externalImports = []
      }
    } else {
      model.externalImports = []
    }
    graphCache.set(root, { model, mtimeMs: info.mtimeMs, size: info.size })
    return model
  }

  async function statusPayload(project) {
    const binary = await resolveBinary()
    const paths = graphPaths(project.root)
    let graph = { exists: false, path: paths.graph, report: existsSync(paths.report) }
    if (existsSync(paths.graph)) {
      try {
        const model = await loadGraph(project.root)
        graph = {
          exists: true,
          path: paths.graph,
          report: existsSync(paths.report),
          bytes: model.bytes,
          builtAt: model.mtimeMs,
          schemaVersion: model.schemaVersion,
          graphifyVersion: model.graphifyVersion,
          stats: model.stats,
        }
      } catch (error) {
        graph = { exists: true, path: paths.graph, report: existsSync(paths.report), error: messageOf(error) }
      }
    }
    return {
      root: project.root,
      sessionRoot: project.sessionRoot,
      binary: {
        available: Boolean(binary.path),
        command: binary.path || text(config.command),
        version: binary.version,
      },
      graph,
      build: publicJob(jobs.get(project.root)),
    }
  }

  /* ---------------------------------------------------------------- builds */

  function publicJob(job) {
    if (!job) return { state: 'idle' }
    return {
      state: job.state,
      mode: job.mode,
      step: job.step,
      lines: job.lines.slice(-40),
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      summary: job.summary || null,
    }
  }

  function startProcess(job, command, args, cwd, step) {
    return new Promise((resolvePromise, reject) => {
      let child
      try {
        child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
      } catch (error) {
        reject(error)
        return
      }
      job.child = child
      job.step = step
      job.lines.push(`$ ${basename(command)} ${args.join(' ')}`)
      let stderr = ''
      const collect = (chunk) => {
        for (const line of splitLines(chunk.toString())) {
          job.lines.push(line)
          if (job.lines.length > 240) job.lines.splice(0, job.lines.length - 240)
        }
      }
      child.stdout?.on('data', collect)
      child.stderr?.on('data', (chunk) => {
        stderr = capText(stderr + chunk.toString())
        collect(chunk)
      })
      const timeout = setTimeout(() => {
        try {
          child.kill('SIGTERM')
        } catch {}
      }, config.buildTimeoutMs)
      child.on('error', (error) => {
        clearTimeout(timeout)
        job.child = null
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timeout)
        job.child = null
        if (job.cancelled) {
          reject(new Error('build cancelled'))
          return
        }
        if (code !== 0) {
          reject(new Error(splitLines(stderr).slice(-8).join('\n') || `graphify exited with code ${code}`))
          return
        }
        resolvePromise()
      })
    })
  }

  async function runBuild(job, root) {
    const binary = await resolveBinary(true)
    if (!binary.path) throw new Error('graphify CLI not found. Install it with: uv tool install graphifyy')
    const args = [root, '--code-only', '--max-workers', String(clamp(config.maxWorkers, 1, 16, 1))]
    await startProcess(job, binary.path, args, root, 'extract')
    const clusterArgs = ['cluster-only', root, '--no-viz']
    if (!config.labelCommunities) clusterArgs.push('--no-label')
    await startProcess(job, binary.path, clusterArgs, root, 'cluster')
    if (!existsSync(graphPaths(root).graph)) {
      throw new Error('the build finished but no graph.json was produced; does the project contain supported code files?')
    }
    graphCache.delete(root)
    const model = await loadGraph(root)
    job.summary = { ...model.stats, bytes: model.bytes }
  }

  function startBuild(project, mode) {
    const existing = jobs.get(project.root)
    if (existing && existing.state === 'running') {
      return { started: false, build: publicJob(existing) }
    }
    const job = {
      state: 'running',
      mode: mode === 'update' ? 'update' : 'build',
      step: 'starting',
      lines: [],
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
      summary: null,
      child: null,
      cancelled: false,
    }
    jobs.set(project.root, job)
    runBuild(job, project.root)
      .then(() => {
        job.state = 'ok'
        job.step = 'done'
        job.finishedAt = Date.now()
      })
      .catch((error) => {
        job.state = job.cancelled ? 'cancelled' : 'error'
        job.step = 'failed'
        job.finishedAt = Date.now()
        job.error = messageOf(error)
      })
    return { started: true, build: publicJob(job) }
  }

  function cancelBuild(project) {
    const job = jobs.get(project.root)
    if (!job || job.state !== 'running') return false
    job.cancelled = true
    try {
      job.child?.kill('SIGTERM')
    } catch {}
    setTimeout(() => {
      try {
        job.child?.kill('SIGKILL')
      } catch {}
    }, 2500).unref?.()
    return true
  }

  async function waitForJob(root, timeoutMs) {
    const started = Date.now()
    const job = jobs.get(root)
    if (!job) return null
    while (job.state === 'running' && Date.now() - started < timeoutMs) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300))
    }
    return publicJob(job)
  }

  /* --------------------------------------------------------------- routes */

  function registerRoute(path, methods, handler, label) {
    ctx.effect(
      () =>
        ctx.connection.fetch.register({
          path,
          methods,
          requestBody: 'buffered',
          fetch: async (request) => {
            try {
              return json(await handler(request))
            } catch (error) {
              return json({ error: messageOf(error) }, typeof error?.status === 'number' ? error.status : 500)
            }
          },
        }),
      label,
    )
  }

  const requestUrl = (request) => new URL(request.url, 'http://localhost')
  const requestBody = async (request) => {
    try {
      return await request.json()
    } catch {
      return {}
    }
  }

  registerRoute(
    '/api/graphify.status',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      return statusPayload(project)
    },
    'graphify: status route',
  )

  registerRoute(
    '/api/graphify.graph',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      return {
        root: project.root,
        ...explorePayload(model, url.searchParams.get('maxNodes') ?? config.maxNodes),
        stats: model.stats,
        schemaVersion: model.schemaVersion,
        graphifyVersion: model.graphifyVersion,
        builtAt: model.mtimeMs,
      }
    },
    'graphify: explore route',
  )

  registerRoute(
    '/api/graphify.tree',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      return { root: project.root, tree: model.tree, stats: model.stats }
    },
    'graphify: tree route',
  )

  registerRoute(
    '/api/graphify.deps',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      const level = url.searchParams.get('level') === 'folder' ? 'folder' : 'file'
      return { root: project.root, ...depsFor(model, level), modelStats: model.stats }
    },
    'graphify: deps route',
  )

  registerRoute(
    '/api/graphify.node',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      return nodeDetail(model, url.searchParams.get('id') || '')
    },
    'graphify: node route',
  )

  registerRoute(
    '/api/graphify.file',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      return fileDetail(model, url.searchParams.get('path') || '')
    },
    'graphify: file route',
  )

  registerRoute(
    '/api/graphify.search',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      return searchPayload(model, url.searchParams.get('q') || '', url.searchParams.get('limit'))
    },
    'graphify: search route',
  )

  registerRoute(
    '/api/graphify.path',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      return nodePath(model, url.searchParams.get('from') || '', url.searchParams.get('to') || '')
    },
    'graphify: path route',
  )

  registerRoute(
    '/api/graphify.impact',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const model = await loadGraph(project.root)
      return fileImpact(model, url.searchParams.get('file') || '', url.searchParams.get('depth'))
    },
    'graphify: impact route',
  )

  registerRoute(
    '/api/graphify.report',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const project = resolveProject(url.searchParams.get('session'), url.searchParams.get('root'))
      const file = graphPaths(project.root).report
      if (!existsSync(file)) return { path: file, text: '', exists: false }
      return { path: file, text: capText(await readFile(file, 'utf8'), MAX_REPORT_BYTES), exists: true }
    },
    'graphify: report route',
  )

  registerRoute(
    '/api/graphify.projects',
    ['GET'],
    async () => {
      const items = []
      try {
        const registry = ctx.get?.('workspaceRegistry')
        for (const workspace of registry?.list?.() || []) {
          items.push({ id: text(workspace?.id), path: workspace?.path, title: text(workspace?.title) || basename(workspace?.path || '') })
        }
      } catch {}
      let fallback = ''
      try {
        fallback = text(ctx.get?.('workingDirectory')?.defaultDirectory)
      } catch {}
      if (!fallback && items[0]) fallback = items[0].path
      return { items, default: fallback }
    },
    'graphify: projects route',
  )

  registerRoute(
    '/api/graphify.externals',
    ['GET'],
    async (request) => {
      const url = requestUrl(request)
      const root = resolveWorkspaceRoot(url.searchParams.get('root'))
      const manual = await readManual()
      const binary = await resolveBinary()
      const paths = graphPaths(root)
      let graphModel = null
      if (existsSync(paths.graph)) {
        try {
          graphModel = await loadGraph(root)
        } catch {}
      }
      const collected = await collectExternals(root, manual, graphModel)
      return {
        root,
        binary: { available: Boolean(binary.path), command: binary.path || text(config.command), version: binary.version },
        graph: {
          exists: existsSync(paths.graph),
          path: paths.graph,
          report: existsSync(paths.report),
        },
        ...collected,
      }
    },
    'graphify: externals route',
  )

  registerRoute(
    '/api/graphify.externals.update',
    ['POST'],
    async (request) => {
      const body = await requestBody(request)
      const root = resolveWorkspaceRoot(body?.root)
      const action = text(body?.action)
      const name = text(body?.name).trim()
      const ecosystem = text(body?.ecosystem).trim() || 'manual'
      const key = manualKey(ecosystem, name)
      if (!['verify', 'ignore', 'reset', 'note', 'add', 'remove'].includes(action)) {
        throw statusError('unknown action', 400)
      }
      manualQueue = manualQueue
        .catch(() => {})
        .then(async () => {
          const data = await readManual()
          if (!data.projects[root] || typeof data.projects[root] !== 'object') data.projects[root] = {}
          const project = data.projects[root]
          if (!project.deps || typeof project.deps !== 'object') project.deps = {}
          if (!Array.isArray(project.custom)) project.custom = []
          if (action === 'add') {
            if (!name) throw statusError('name is required', 400)
            project.custom.push({
              name,
              ecosystem,
              range: text(body?.range).trim(),
              createdAt: Date.now(),
            })
          } else if (action === 'remove') {
            project.custom = project.custom.filter((entry) => manualKey(entry.ecosystem || 'manual', entry.name) !== key)
            delete project.deps[key]
          } else {
            if (!name) throw statusError('name is required', 400)
            const record = project.deps[key] || {}
            if (action === 'verify') {
              record.status = 'verified'
              record.verifiedAt = Date.now()
              if (hasOwn(body, 'note')) record.note = text(body.note)
            } else if (action === 'ignore') {
              record.status = 'ignored'
              record.updatedAt = Date.now()
            } else if (action === 'reset') {
              delete project.deps[key]
            } else if (action === 'note') {
              record.note = text(body.note)
              record.updatedAt = Date.now()
            }
            if (project.deps[key] || Object.keys(record).length > 0) project.deps[key] = record
          }
          data.version = MANUAL_VERSION
          await writeManual(data)
          return data
        })
      await manualQueue
      const manual = await readManual()
      let graphModel = null
      if (existsSync(graphPaths(root).graph)) {
        try {
          graphModel = await loadGraph(root)
        } catch {}
      }
      return { root, ...(await collectExternals(root, manual, graphModel)) }
    },
    'graphify: externals update route',
  )

  registerRoute(
    '/api/graphify.build',
    ['POST'],
    async (request) => {
      const body = await requestBody(request)
      const project = resolveProject(text(body?.session), body?.root)
      const result = startBuild(project, body?.mode)
      return { ...result, status: await statusPayload(project) }
    },
    'graphify: build route',
  )

  registerRoute(
    '/api/graphify.cancel',
    ['POST'],
    async (request) => {
      const body = await requestBody(request)
      const project = resolveProject(text(body?.session), body?.root)
      return { cancelled: cancelBuild(project), build: publicJob(jobs.get(project.root)) }
    },
    'graphify: cancel route',
  )

  /* ------------------------------------------------------------------ tool */

  function formatTreeLines(tree, depth, lines, prefix) {
    if (lines.length >= 90) return
    const indent = '  '.repeat(depth)
    const suffix = tree.type === 'dir' ? ` (${tree.count})` : tree.type === 'file' ? ` (${tree.count - 1} symbols)` : ''
    lines.push(`${indent}${prefix}${tree.name}${suffix}`)
    if (!tree.children || tree.children.length === 0 || depth >= 4) return
    for (const child of tree.children) {
      formatTreeLines(child, depth + 1, lines, '')
    }
  }

  function findTree(tree, path) {
    if (!path) return tree
    const normalized = norm(path)
    if (tree.path === normalized) return tree
    for (const child of tree.children || []) {
      const found = findTree(child, normalized)
      if (found) return found
    }
    return null
  }

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'graphify',
        description: [
          'Explore the current project\'s graphify knowledge graph: a local tree-sitter AST graph of files, symbols, imports, calls, and inheritance.',
          'Use it before broad file searches for symbol, import, call, dependency, and impact questions.',
          'query takes identifiers, file names, or distinctive keywords, not full sentences; path traces two nodes, affected finds reverse dependents.',
          'tree summarizes the directory/symbol hierarchy, deps summarizes file dependencies, cycles, and hubs, externals lists declared or unresolved third-party packages.',
          'build and update run a local code-only build (no API key) and write graphify-out/ in the project; they can take minutes, so status reports progress.',
          'The Graph tab shows the same graph plus a visual explorer.',
        ].join(' '),
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: {
              type: 'string',
              enum: ['status', 'query', 'explain', 'path', 'affected', 'god_nodes', 'tree', 'deps', 'externals', 'impact', 'build', 'update'],
              description: 'Operation to run. query/explain/path/affected read an existing graph; tree/deps/externals/impact summarize the derived views; build/update create or refresh the graph.',
            },
            question: { type: 'string', description: 'Keywords, a symbol, or a file name for query. Not a full sentence.' },
            node: { type: 'string', description: 'Symbol label or node id for explain or affected.' },
            source: { type: 'string', description: 'Start node label or id for path.' },
            target: { type: 'string', description: 'End node label or id for path.' },
            file: { type: 'string', description: 'Project-relative file path for tree, deps, or impact.' },
            depth: { type: 'integer', description: 'Traversal depth, 1-6. Default 2 for affected and impact.' },
            budget: { type: 'integer', description: 'Token budget for query output, 200-4000. Default 1200.' },
            mode: { type: 'string', enum: ['bfs', 'dfs'], description: 'Traversal mode for query. Default bfs.' },
            top: { type: 'integer', description: 'Number of hub nodes for god_nodes or deps, 1-30. Default 10.' },
            level: { type: 'string', enum: ['file', 'folder'], description: 'Dependency aggregation level. Default file.' },
          },
          required: ['action'],
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
          const action = text(args?.action)
          const sessionId = text(exec?.agent?.id)
          const project = resolveProject(sessionId)
          const root = project.root

          if (action === 'build' || action === 'update') {
            const started = startBuild(project, action)
            const build = await waitForJob(root, clamp(config.toolWaitMs, 5000, 600000, 120000))
            if (!build) throw new Error('the build did not start')
            if (build.state === 'ok') {
              return {
                text: `Graph ${action === 'update' ? 'updated' : 'built'} for ${root}.\n${build.summary ? `${build.summary.nodes} nodes · ${build.summary.edges} edges · ${build.summary.files} files · ${build.summary.communities} communities` : ''}\n${build.lines.slice(-6).join('\n')}`,
              }
            }
            if (build.state === 'running') {
              return { text: `Build still running (${build.step}). Ask again with action "status" for progress; the Graph tab also shows it.` }
            }
            throw new Error(`Build ${build.state}: ${build.error || 'unknown error'}\n${build.lines.slice(-12).join('\n')}`)
          }

          if (action === 'status') {
            const status = await statusPayload(project)
            const lines = [`Project: ${root}`, `graphify: ${status.binary.available ? status.binary.version || status.binary.command : 'not installed'}`]
            if (!status.graph.exists) lines.push('Graph: not built. Use action "build".')
            else {
              const stats = status.graph.stats || {}
              const built = status.graph.builtAt ? new Date(status.graph.builtAt).toISOString() : 'unknown'
              lines.push(`Graph: ${stats.nodes ?? '?'} nodes · ${stats.edges ?? '?'} edges · ${stats.files ?? '?'} files · ${stats.communities ?? '?'} communities · built ${built}`)
              lines.push(`File: ${status.graph.path}`)
            }
            if (status.build.state === 'running') lines.push(`Build: running (${status.build.step})`)
            else if (status.build.state === 'error') lines.push(`Last build failed: ${status.build.error}`)
            return { text: lines.join('\n') }
          }

          if (action !== 'externals' && !existsSync(graphPaths(root).graph)) {
            throw new Error(`No graph for ${root}. Build it in the Graph tab or call action "build".`)
          }

          if (action === 'query') {
            const question = text(args?.question).trim()
            if (!question) throw new Error('question is required for query')
            const cli = ['query', question, '--budget', String(clamp(args?.budget, 200, 4000, 1200))]
            if (args?.mode === 'dfs') cli.push('--dfs')
            const output = await runCli(root, cli)
            if (!output || /no matching nodes/i.test(output)) {
              try {
                const model = await loadGraph(root)
                const matches = searchPayload(model, question, 6).results
                if (matches.length > 0) {
                  return {
                    text: `No graph traversal match for "${question}". Closest labels and files:\n${matches.map((item) => `- ${item.label}${item.file ? ` (${item.file}${item.line ? `:${item.line}` : ''})` : ''}`).join('\n')}\nRetry query with one of these identifiers.`,
                  }
                }
              } catch {}
              return { text: `No matching nodes for "${question}". Try a symbol name, file name, or a rare keyword.` }
            }
            return { text: output }
          }

          if (action === 'explain') {
            const node = text(args?.node).trim()
            if (!node) throw new Error('node is required for explain')
            return { text: (await runCli(root, ['explain', node])) || `No node matched "${node}".` }
          }

          if (action === 'path') {
            const source = text(args?.source).trim()
            const target = text(args?.target).trim()
            if (!source || !target) throw new Error('source and target are required for path')
            const output = await runCli(root, ['path', source, target])
            return { text: output || 'No path found.' }
          }

          if (action === 'affected') {
            const node = text(args?.node).trim()
            if (!node) throw new Error('node is required for affected')
            const output = await runCli(root, ['affected', node, '--depth', String(clamp(args?.depth, 1, 6, 2))])
            return { text: output || `Nothing depends on "${node}".` }
          }

          if (action === 'god_nodes') {
            const top = clamp(args?.top, 1, 30, 10)
            const output = await runCli(root, ['god-nodes', '--json', '--top', String(top)])
            let parsed
            try {
              parsed = JSON.parse(output)
            } catch {
              return { text: output || 'No hub nodes.' }
            }
            if (!Array.isArray(parsed) || parsed.length === 0) return { text: 'No hub nodes.' }
            return {
              text: parsed
                .slice(0, top)
                .map((node, index) => `${index + 1}. ${node.label || node.id} — ${node.degree ?? '?'} edges`)
                .join('\n'),
            }
          }

          const model = action === 'externals' ? null : await loadGraph(root)

          if (action === 'tree') {
            const tree = findTree(model.tree, text(args?.file))
            if (!tree) throw new Error(`No tree entry for "${args?.file}".`)
            const lines = [`Tree for ${root} — ${model.stats.files} files, ${model.stats.symbols} symbols`]
            formatTreeLines(tree, 0, lines, '')
            if (lines.length >= 90) lines.push('… (truncated; use the Graph tab for the full tree)')
            return { text: lines.join('\n') }
          }

          if (action === 'deps') {
            const level = args?.level === 'folder' ? 'folder' : 'file'
            const deps = depsFor(model, level)
            const top = clamp(args?.top, 1, 30, 10)
            const focus = text(args?.file).trim()
            const lines = [
              `Dependencies (${level}) — ${deps.stats.nodes} nodes · ${deps.stats.edges} edges · ${deps.stats.cycles} import cycles`,
              `Top depended on: ${deps.topIn.slice(0, top).map((item) => `${item.label} (${item.count})`).join(', ') || 'none'}`,
              `Top dependencies: ${deps.topOut.slice(0, top).map((item) => `${item.label} (${item.count})`).join(', ') || 'none'}`,
            ]
            if (deps.cycles.length > 0) {
              lines.push(`Cycles: ${deps.cycles.slice(0, 3).map((cycle) => cycle.join(' ↔ ')).join(' | ')}`)
            }
            if (focus) {
              const file = norm(focus)
              const outgoing = deps.edges.filter((edge) => edge.source === file).slice(0, top)
              const incoming = deps.edges.filter((edge) => edge.target === file).slice(0, top)
              lines.push(`\n${file} imports (${outgoing.length}): ${outgoing.map((edge) => `${edge.target} [${Object.keys(edge.relations).join(', ')}]`).join(', ') || 'none'}`)
              lines.push(`${file} imported by (${incoming.length}): ${incoming.map((edge) => `${edge.source} [${Object.keys(edge.relations).join(', ')}]`).join(', ') || 'none'}`)
            }
            if (deps.external.length > 0) {
              lines.push(`External stubs: ${deps.external.slice(0, 8).map((item) => `${item.name} (${item.count})`).join(', ')}`)
            }
            return { text: lines.join('\n') }
          }

          if (action === 'impact') {
            const file = text(args?.file).trim()
            if (!file) throw new Error('file is required for impact')
            const impact = fileImpact(model, file, args?.depth)
            if (impact.files.length === 0) return { text: `Nothing depends on ${impact.file} up to depth ${impact.depth}.` }
            return {
              text: [
                `Files impacted by ${impact.file} (depth ${impact.depth}, ${impact.total} total):`,
                ...impact.files.slice(0, 40).map((item) => `${item.distance}. ${item.file} — via ${item.via} [${item.relations.join(', ')}]`),
              ].join('\n'),
            }
          }

          if (action === 'externals') {
            const manual = await readManual()
            let graphModel = null
            if (existsSync(graphPaths(root).graph)) {
              try {
                graphModel = await loadGraph(root)
              } catch {}
            }
            const collected = await collectExternals(root, manual, graphModel)
            const attention = collected.deps.filter((dep) => dep.status !== 'verified' && dep.status !== 'ignored' && dep.status !== 'installed')
            const lines = [
              `External dependencies for ${root}: ${collected.deps.length} total, ${collected.manifests.length} manifests.`,
            ]
            if (attention.length === 0) lines.push('Nothing needs attention.')
            else {
              lines.push('Needs attention:')
              for (const dep of attention.slice(0, 40)) {
                lines.push(`- ${dep.name} [${dep.ecosystem}] ${dep.status}${dep.range ? ` ${dep.range}` : ''}${dep.manifest ? ` (${dep.manifest})` : ''}`)
              }
              if (attention.length > 40) lines.push(`… and ${attention.length - 40} more; see Settings → Dependencies.`)
            }
            return { text: lines.join('\n') }
          }

          throw new Error(`Unknown action "${action}".`)
        },
      }),
    'graphify: graphify tool',
  )

  /* ------------------------------------------------------------ prompt seat */

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'graphify',
        order: 2990,
        text: (assembly) => {
          if (!config.promptHint) return ''
          try {
            const sessionId = text(assembly?.agent?.id ?? assembly?.scope?.id)
            const session = sessionRoot(sessionId)
            if (!session) return ''
            const model = graphCache.get(resolve(session))?.model
            if (!model) {
              if (!existsSync(graphPaths(resolve(session)).graph)) return ''
              return `A graphify code graph exists for this project. Use the \`graphify\` tool (status/query/deps) before broad file searches.`
            }
            const built = new Date(model.mtimeMs).toISOString().slice(0, 10)
            return `A graphify code graph for this project is available (${model.stats.nodes} nodes, ${model.stats.files} files, built ${built}). Use the \`graphify\` tool for symbol, import, dependency, and impact questions before broad searches; \`query\` takes identifiers or file names, not sentences.`
          } catch {
            return ''
          }
        },
      }),
    'graphify: prompt section',
  )

  /* --------------------------------------------------------------- cleanup */

  ctx.effect(
    () => () => {
      for (const job of jobs.values()) {
        if (job.state !== 'running') continue
        job.cancelled = true
        try {
          job.child?.kill('SIGTERM')
        } catch {}
      }
      graphCache.clear()
    },
    'graphify: dispose builds',
  )

  return undefined
}

/**
 * Language harness generation.
 *
 * The arena never runs a solution in the Host process. Each attempt gets a
 * fresh temporary directory containing the user's code plus a small runner.
 * Python and JavaScript prepare one process per case; C++ compiles one binary
 * whose `argv[1]` selects the case, which keeps crashes and global state from
 * leaking between tests.
 */

/** Language descriptors shared by the Host and the browser. */
export const LANGUAGES = [
  { id: 'python', label: 'Python', extension: 'py' },
  { id: 'javascript', label: 'JavaScript', extension: 'js' },
  { id: 'cpp', label: 'C++', extension: 'cpp' },
]

const SCALARS = new Set(['integer', 'long', 'double', 'boolean', 'string', 'character'])
const CPPTYPE = {
  integer: 'int',
  long: 'long long',
  double: 'double',
  boolean: 'bool',
  string: 'string',
  character: 'char',
  'integer[]': 'vector<int>',
  'long[]': 'vector<long long>',
  'integer[][]': 'vector<vector<int>>',
  'string[]': 'vector<string>',
  'character[]': 'vector<char>',
  'character[][]': 'vector<vector<char>>',
  'boolean[]': 'vector<bool>',
  'double[]': 'vector<double>',
  ListNode: 'ListNode*',
  TreeNode: 'TreeNode*',
}

/** True when a definition looks like a LeetCode design problem. */
export function isDesignProblem(meta) {
  return Boolean(meta && typeof meta === 'object' && typeof meta.classname === 'string')
}

/** Normalize the GraphQL `metaData` shape into the arena's problem meta. */
export function normalizeMeta(raw) {
  if (!raw) return null
  let meta = raw
  if (typeof raw === 'string') {
    try {
      meta = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!meta || typeof meta !== 'object') return null
  if (isDesignProblem(meta)) {
    return {
      design: true,
      classname: meta.classname,
      methods: Array.isArray(meta.methods) ? meta.methods : [],
      name: meta.classname,
      params: [],
      return: { type: 'void' },
    }
  }
  if (typeof meta.name !== 'string' || !Array.isArray(meta.params)) return null
  const params = meta.params
    .filter((p) => p && typeof p.name === 'string' && typeof p.type === 'string')
    .map((p) => ({ name: p.name, type: p.type }))
  const returnType = meta.return && typeof meta.return.type === 'string' ? meta.return.type : 'void'
  const outputIndex =
    meta.output && Number.isInteger(meta.output.paramindex) ? meta.output.paramindex : undefined
  return {
    name: meta.name,
    params,
    return: { type: returnType },
    ...(outputIndex === undefined ? {} : { outputIndex }),
    design: false,
  }
}

/** Whether a language can run this signature. */
export function supportsLanguage(meta, language) {
  if (!meta || meta.design) return false
  if (language === 'python' || language === 'javascript') return true
  if (language !== 'cpp') return false
  if (meta.return.type !== 'void' && !CPPTYPE[meta.return.type]) return false
  if (meta.return.type === 'void' && meta.outputIndex === undefined) return false
  return meta.params.every((p) => Boolean(CPPTYPE[p.type]))
}

/** Every supported language for this signature, in stable order. */
export function supportedLanguages(meta) {
  return LANGUAGES.filter((l) => supportsLanguage(meta, l.id)).map((l) => l.id)
}

/** The JSON value a test result should be compared against. */
export function outputIndex(meta) {
  return Number.isInteger(meta?.outputIndex) ? meta.outputIndex : undefined
}

/** Quote a value for a JSON-ish output line. */
export function jsonText(value) {
  return JSON.stringify(value)
}

/* ------------------------------------------------------------------ */
/* Python                                                              */
/* ------------------------------------------------------------------ */

/**
 * Build the per-case Python runner. The problem meta travels in `LC_META` and
 * one case's args arrive on stdin, so no problem data is interpolated into
 * executable source.
 */
export function pythonRunner() {
  return `import io, json, os, sys, typing, collections, heapq, math, bisect, itertools, functools, re

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def _build_list(vals):
    dummy = ListNode()
    cur = dummy
    for v in vals:
        cur.next = ListNode(v)
        cur = cur.next
    return dummy.next

def _dump_list(node):
    out = []
    guard = 0
    while node is not None and guard < 1000000:
        out.append(node.val)
        node = node.next
        guard += 1
    return out

def _build_tree(vals):
    if not vals or vals[0] is None:
        return None
    root = TreeNode(vals[0])
    queue = [root]
    i = 1
    while queue and i < len(vals):
        node = queue.pop(0)
        if i < len(vals) and vals[i] is not None:
            node.left = TreeNode(vals[i])
            queue.append(node.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            node.right = TreeNode(vals[i])
            queue.append(node.right)
        i += 1
    return root

def _dump_tree(root):
    if root is None:
        return []
    out = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out

def _convert(value, typ):
    if typ == 'ListNode':
        return _build_list(value)
    if typ == 'TreeNode':
        return _build_tree(value)
    return value

def _dump(value, typ):
    if typ == 'ListNode':
        return _dump_list(value)
    if typ == 'TreeNode':
        return _dump_tree(value)
    return value

def _fail(message):
    sys.stdout.write(json.dumps({'__lc_error': message}))
    raise SystemExit(0)

def main():
    sys.setrecursionlimit(100000)
    try:
        meta = json.loads(os.environ['LC_META'])
        args = json.loads(sys.stdin.read())
    except Exception as exc:
        _fail('invalid harness input: ' + repr(exc))
        return

    ns = {
        '__name__': 'solution',
        '__file__': 'solution.py',
        'ListNode': ListNode,
        'TreeNode': TreeNode,
        'deque': collections.deque,
        'defaultdict': collections.defaultdict,
        'Counter': collections.Counter,
        'OrderedDict': collections.OrderedDict,
        'Optional': typing.Optional,
        'List': typing.List,
        'Dict': typing.Dict,
        'Set': typing.Set,
        'Tuple': typing.Tuple,
        'Any': typing.Any,
        'heappush': heapq.heappush,
        'heappop': heapq.heappop,
        'heapify': heapq.heapify,
        'nlargest': heapq.nlargest,
        'nsmallest': heapq.nsmallest,
        'bisect_left': bisect.bisect_left,
        'bisect_right': bisect.bisect_right,
        'cache': functools.cache,
        'lru_cache': functools.lru_cache,
        'reduce': functools.reduce,
        'accumulate': itertools.accumulate,
        'combinations': itertools.combinations,
        'permutations': itertools.permutations,
        'product': itertools.product,
        'gcd': math.gcd,
        'inf': math.inf,
        'isqrt': math.isqrt,
        'heapq': heapq,
        'bisect': bisect,
        'itertools': itertools,
        'functools': functools,
        'math': math,
        're': re,
    }

    try:
        source = open('solution.py', 'r', encoding='utf-8').read()
        sink = io.StringIO()
        with __import__('contextlib').redirect_stdout(sink):
            exec(compile(source, 'solution.py', 'exec'), ns)
        Solution = ns.get('Solution')
        fn = None
        if Solution is not None:
            fn = getattr(Solution(), meta['name'], None)
        if fn is None:
            fn = ns.get(meta['name'])
        if fn is None:
            _fail('no Solution.%s or top-level %s found' % (meta['name'], meta['name']))
            return
        converted = [
            _convert(args[i], p['type']) if i < len(args) else None
            for i, p in enumerate(meta['params'])
        ]
        with __import__('contextlib').redirect_stdout(sink):
            result = fn(*converted)
        if meta['returnType'] == 'void':
            index = meta.get('outputIndex')
            if index is None:
                result = None
            else:
                result = converted[index]
        dumped = _dump(result, meta['returnType'])
        sys.stdout.write(json.dumps(dumped))
    except SystemExit:
        raise
    except Exception as exc:
        _fail(type(exc).__name__ + ': ' + str(exc))

if __name__ == '__main__':
    main()
`
}

/* ------------------------------------------------------------------ */
/* JavaScript                                                          */
/* ------------------------------------------------------------------ */

/** Build the per-case JavaScript runner. */
export function javascriptRunner() {
  return `import fs from 'node:fs';

class ListNode {
  constructor(val = 0, next = null) { this.val = val; this.next = next; }
}
class TreeNode {
  constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; }
}

function buildList(values) {
  const dummy = new ListNode();
  let cur = dummy;
  for (const value of values) { cur.next = new ListNode(value); cur = cur.next; }
  return dummy.next;
}
function dumpList(node) {
  const out = [];
  let guard = 0;
  while (node != null && guard < 1000000) { out.push(node.val); node = node.next; guard += 1; }
  return out;
}
function buildTree(values) {
  if (!values.length || values[0] === null) return null;
  const root = new TreeNode(values[0]);
  const queue = [root];
  let i = 1;
  while (queue.length && i < values.length) {
    const node = queue.shift();
    if (i < values.length && values[i] !== null) { node.left = new TreeNode(values[i]); queue.push(node.left); }
    i += 1;
    if (i < values.length && values[i] !== null) { node.right = new TreeNode(values[i]); queue.push(node.right); }
    i += 1;
  }
  return root;
}
function dumpTree(root) {
  if (root === null) return [];
  const out = [];
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (node === null) { out.push(null); continue; }
    out.push(node.val);
    queue.push(node.left, node.right);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
function convert(value, type) {
  if (type === 'ListNode') return buildList(value);
  if (type === 'TreeNode') return buildTree(value);
  return value;
}
function dump(value, type) {
  if (type === 'ListNode') return dumpList(value);
  if (type === 'TreeNode') return dumpTree(value);
  return value;
}

const meta = JSON.parse(process.env.LC_META);
const source = fs.readFileSync(new URL('./solution.js', import.meta.url), 'utf8');
const safeConsole = {
  log: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
  info: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
  warn: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
  error: (...args) => process.stderr.write(args.map(String).join(' ') + '\\n'),
};

function fail(message) {
  process.stdout.write(JSON.stringify({ __lc_error: message }));
  process.exit(0);
}

let target;
try {
  const factory = new Function(
    'ListNode', 'TreeNode', 'console',
    source + '\\n; return typeof Solution !== "undefined" ? Solution : (typeof ' + meta.name + ' !== "undefined" ? ' + meta.name + ' : undefined);',
  );
  target = factory(ListNode, TreeNode, safeConsole);
} catch (error) {
  fail('SyntaxError: ' + String(error && error.message ? error.message : error));
}

let fn;
try {
  if (typeof target === 'function' && target.prototype && typeof target.prototype[meta.name] === 'function') {
    const instance = new target();
    fn = instance[meta.name].bind(instance);
  } else if (typeof target === 'function') {
    fn = target;
  }
} catch (error) {
  fail('setup error: ' + String(error && error.message ? error.message : error));
}
if (typeof fn !== 'function') {
  fail('no Solution.' + meta.name + ' or top-level ' + meta.name + ' found');
}

try {
  const args = JSON.parse(fs.readFileSync(0, 'utf8'));
  const converted = meta.params.map((p, i) => convert(args[i], p.type));
  const result = fn(...converted);
  let output = result;
  if (meta.returnType === 'void') {
    output = meta.outputIndex === undefined ? null : converted[meta.outputIndex];
  }
  const dumped = dump(output, meta.returnType);
  if (dumped === undefined) throw new Error('the function returned undefined');
  process.stdout.write(JSON.stringify(dumped));
} catch (error) {
  fail((error && error.name ? error.name + ': ' : '') + String(error && error.message ? error.message : error));
}
`
}

/* ------------------------------------------------------------------ */
/* C++                                                                 */
/* ------------------------------------------------------------------ */

function cppString(value) {
  // JSON string escaping is valid C++ for the characters LeetCode inputs use.
  return JSON.stringify(String(value))
}

function cppChar(value) {
  const ch = String(value)
  const map = {
    '\\': '\\\\',
    "'": "\\'",
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\b': '\\b',
    '\f': '\\f',
    '\0': '\\0',
  }
  return `'${map[ch] ?? (ch.codePointAt(0) < 32 ? `\\x${ch.codePointAt(0).toString(16).padStart(2, '0')}` : ch)}'`
}

function cppNumber(value, type) {
  if (type === 'double') {
    const text = String(value)
    return /[.eE]/.test(text) ? text : `${text}.0`
  }
  if (type === 'long') return `${value}LL`
  return String(value)
}

function cppLiteral(value, type) {
  if (type === 'ListNode') {
    return `__lc_list(vector<int>{${value.map((v) => cppNumber(v, 'integer')).join(',')}})`
  }
  if (type === 'TreeNode') {
    const items = value.map((v) => (v === null ? 'nullopt' : cppNumber(v, 'integer')))
    return `__lc_tree(vector<optional<int>>{${items.join(',')}})`
  }
  if (type === 'string') return cppString(value)
  if (type === 'character') return cppChar(value)
  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'integer' || type === 'long' || type === 'double') return cppNumber(value, type)
  if (type.endsWith('[]') && !type.endsWith('[][]')) {
    const inner = type.slice(0, -2)
    const items = (value ?? []).map((v) => cppLiteral(v, inner))
    return `${CPPTYPE[type]}{${items.join(',')}}`
  }
  if (type.endsWith('[][]')) {
    const inner = type.slice(0, -2)
    const rows = (value ?? []).map((row) => cppLiteral(row, inner))
    return `${CPPTYPE[type]}{${rows.join(',')}}`
  }
  throw new Error(`unsupported C++ type ${type}`)
}

const CPP_HELPERS = `#include <bits/stdc++.h>
using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

static string __lc_escape(const string &s) {
    string out;
    out.reserve(s.size() + 8);
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\\\\""; break;
            case '\\\\': out += "\\\\\\\\"; break;
            case '\\n': out += "\\\\n"; break;
            case '\\r': out += "\\\\r"; break;
            case '\\t': out += "\\\\t"; break;
            case '\\b': out += "\\\\b"; break;
            case '\\f': out += "\\\\f"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\\\u%04x", c);
                    out += buf;
                } else {
                    out += (char)c;
                }
        }
    }
    return out;
}

static string __lc_json(int v) { return to_string(v); }
static string __lc_json(long long v) { return to_string(v); }
static string __lc_json(bool v) { return v ? "true" : "false"; }
static string __lc_json(char v) { return "\\"" + __lc_escape(string(1, v)) + "\\""; }
static string __lc_json(const string &v) { return "\\"" + __lc_escape(v) + "\\""; }
static string __lc_json(double v) {
    ostringstream os;
    os << setprecision(15) << v;
    string s = os.str();
    if (s.find('.') == string::npos && s.find('e') == string::npos && s.find('E') == string::npos) s += ".0";
    return s;
}

template <typename T>
static string __lc_json(const vector<T> &v) {
    string out = "[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i) out += ",";
        out += __lc_json(v[i]);
    }
    out += "]";
    return out;
}

static string __lc_json(const vector<bool> &v) {
    string out = "[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i) out += ",";
        out += (v[i] ? "true" : "false");
    }
    out += "]";
    return out;
}

static ListNode *__lc_list(const vector<int> &vals) {
    ListNode dummy;
    ListNode *cur = &dummy;
    for (int v : vals) {
        cur->next = new ListNode(v);
        cur = cur->next;
    }
    return dummy.next;
}

static string __lc_json(ListNode *head) {
    string out = "[";
    bool first = true;
    int guard = 0;
    while (head != nullptr && guard < 1000000) {
        if (!first) out += ",";
        out += to_string(head->val);
        first = false;
        head = head->next;
        ++guard;
    }
    out += "]";
    return out;
}

static TreeNode *__lc_tree(const vector<optional<int>> &vals) {
    if (vals.empty() || !vals[0].has_value()) return nullptr;
    TreeNode *root = new TreeNode(*vals[0]);
    queue<TreeNode *> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < vals.size()) {
        TreeNode *node = q.front();
        q.pop();
        if (i < vals.size() && vals[i].has_value()) {
            node->left = new TreeNode(*vals[i]);
            q.push(node->left);
        }
        ++i;
        if (i < vals.size() && vals[i].has_value()) {
            node->right = new TreeNode(*vals[i]);
            q.push(node->right);
        }
        ++i;
    }
    return root;
}

static string __lc_json(TreeNode *root) {
    if (root == nullptr) return "[]";
    vector<optional<int>> out;
    queue<TreeNode *> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode *node = q.front();
        q.pop();
        if (node == nullptr) {
            out.push_back(nullopt);
            continue;
        }
        out.push_back(node->val);
        q.push(node->left);
        q.push(node->right);
    }
    while (!out.empty() && !out.back().has_value()) out.pop_back();
    string s = "[";
    for (size_t i = 0; i < out.size(); ++i) {
        if (i) s += ",";
        if (out[i].has_value()) s += to_string(*out[i]);
        else s += "null";
    }
    s += "]";
    return s;
}
`

/** Build one C++ translation unit with all cases selected by argv[1]. */
export function cppSource(meta, code, tests) {
  const cases = tests.map((test, index) => {
    const args = meta.params.map((p, i) => {
      const literal = cppLiteral(test.args[i], p.type)
      return `${CPPTYPE[p.type]} __a${i} = ${literal};`
    })
    const callArgs = meta.params.map((_, i) => `__a${i}`).join(', ')
    if (meta.return.type === 'void') {
      const indexOut = meta.outputIndex
      const print = indexOut === undefined ? 'nullptr' : `__a${indexOut}`
      return `    case ${index}: {
${args.map((line) => `        ${line}`).join('\n')}
        Solution __sol;
        __sol.${meta.name}(${callArgs});
        cout << __lc_json(${print}) << "\\n";
        break;
    }`
    }
    return `    case ${index}: {
${args.map((line) => `        ${line}`).join('\n')}
        Solution __sol;
        auto __ret = __sol.${meta.name}(${callArgs});
        cout << __lc_json(__ret) << "\\n";
        break;
    }`
  })
  return `${CPP_HELPERS}
${code}

int main(int argc, char **argv) {
    int __case = argc > 1 ? atoi(argv[1]) : 0;
    switch (__case) {
${cases.join('\n')}
        default: return 2;
    }
    return 0;
}
`
}

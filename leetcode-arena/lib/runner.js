/**
 * Bounded local execution for the arena.
 *
 * Security posture: solutions are untrusted local code, so every attempt gets
 * a fresh directory under the arena's own tmp root, a fixed wall-clock limit,
 * a scrubbed environment, and no reuse between cases. This is process
 * isolation, not a kernel sandbox: the arena UI says so, and the Host never
 * executes a solution in its own process.
 */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  cppSource,
  javascriptRunner,
  pythonRunner,
  supportsLanguage,
} from './harness.js'

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_MS = 45_000

/** A single process execution with a hard wall-clock cap. */
function collect({ command, args, cwd, input, timeoutMs, env }) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (error) {
      resolve({ status: null, signal: null, stdout: '', stderr: String(error), timedOut: false, overflow: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let overflow = false
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, Math.max(200, timeoutMs))
    const append = (target, chunk) => {
      if (target.length >= MAX_OUTPUT_BYTES) {
        overflow = true
        child.kill('SIGKILL')
        return target
      }
      return target + chunk.toString('utf8')
    }
    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk)
    })
    child.on('error', (error) => {
      stderr += `\n${String(error)}`
    })
    child.on('close', (status, signal) => {
      clearTimeout(timer)
      resolve({ status, signal, stdout, stderr, timedOut, overflow })
    })
    if (input === undefined || input === null) child.stdin.end()
    else child.stdin.end(input)
  })
}

/** JSON-serializable display form, clipped for transport. */
function display(value, max = 1200) {
  let text
  try {
    text = JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (text === undefined) text = 'undefined'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Compare numbers with a small relative tolerance; everything else exactly. */
export function matches(actual, expected, options = {}) {
  const tolerance = options.tolerance ?? 1e-6
  const unordered = options.unordered === true
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Number.isNaN(actual) && Number.isNaN(expected)) return true
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return Object.is(actual, expected)
    return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected))
  }
  if (actual === expected) return true
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false
    if (unordered) {
      const left = [...actual].map((v) => display(v, 100000)).sort()
      const right = [...expected].map((v) => display(v, 100000)).sort()
      return left.every((v, i) => v === right[i])
    }
    return actual.every((v, i) => matches(v, expected[i], options))
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const a = Object.keys(actual)
    const e = Object.keys(expected)
    if (a.length !== e.length) return false
    return a.every((key) => Object.hasOwn(expected, key) && matches(actual[key], expected[key], options))
  }
  return false
}

/**
 * Run a set of cases.
 *
 * @param {object} input
 * @param {object} input.meta normalized problem meta
 * @param {'python'|'javascript'|'cpp'} input.language
 * @param {string} input.code user solution
 * @param {Array<{args: unknown[], expected: unknown, hidden?: boolean}>} input.tests
 * @param {string} input.tmpRoot writable arena temp root
 * @param {number} [input.timeoutMs]
 * @param {number} [input.compileTimeoutMs]
 * @param {'exact'|'unordered'} [input.compare]
 */
export async function runTests({
  meta,
  language,
  code,
  tests,
  tmpRoot,
  timeoutMs = 3000,
  compileTimeoutMs = 20_000,
  compare = 'exact',
}) {
  const started = Date.now()
  if (!meta || meta.design) {
    return {
      language,
      passed: 0,
      total: tests.length,
      compileError: 'This problem uses a design/class interface, which the arena runner does not execute yet.',
      cases: [],
      durationMs: 0,
    }
  }
  if (!supportsLanguage(meta, language)) {
    return {
      language,
      passed: 0,
      total: tests.length,
      compileError: `${language} cannot run this problem signature yet.`,
      cases: [],
      durationMs: 0,
    }
  }
  if (typeof code !== 'string' || code.trim() === '') {
    return {
      language,
      passed: 0,
      total: tests.length,
      compileError: 'Write some code first.',
      cases: [],
      durationMs: 0,
    }
  }

  await mkdir(tmpRoot, { recursive: true })
  const dir = await mkdtemp(join(tmpRoot, 'run-'))
  const runnerMeta = {
    name: meta.name,
    params: meta.params,
    returnType: meta.return.type,
    ...(Number.isInteger(meta.outputIndex) ? { outputIndex: meta.outputIndex } : {}),
  }
  const env = {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: dir,
    TMPDIR: dir,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    PYTHONIOENCODING: 'utf-8',
    LC_META: JSON.stringify(runnerMeta),
    NODE_OPTIONS: '',
  }

  const cases = []
  let compileError = null
  let deadline = started + MAX_TOTAL_MS

  try {
    let command
    let baseArgs
    if (language === 'python') {
      await writeFile(join(dir, 'solution.py'), code)
      await writeFile(join(dir, 'runner.py'), pythonRunner())
      command = process.env.DSH_PYTHON || 'python3'
      baseArgs = ['-I', '-B', 'runner.py']
    } else if (language === 'javascript') {
      await writeFile(join(dir, 'solution.js'), code)
      await writeFile(join(dir, 'runner.mjs'), javascriptRunner())
      command = process.env.DSH_NODE || 'node'
      baseArgs = ['--no-warnings', 'runner.mjs']
    } else if (language === 'cpp') {
      await writeFile(join(dir, 'main.cpp'), cppSource(meta, code, tests))
      const compile = await collect({
        command: process.env.CXX || 'g++',
        args: ['-std=c++20', '-O2', '-pipe', '-o', 'solution', 'main.cpp'],
        cwd: dir,
        timeoutMs: compileTimeoutMs,
        env,
      })
      if (compile.timedOut) compileError = `Compilation exceeded ${Math.round(compileTimeoutMs / 1000)}s.`
      else if (compile.status !== 0) compileError = (compile.stderr || compile.stdout || 'Compilation failed.').trim()
      else {
        command = join(dir, 'solution')
        baseArgs = []
      }
    } else {
      compileError = `Unknown language: ${language}`
    }

    if (!compileError) {
      for (const [index, test] of tests.entries()) {
        if (Date.now() > deadline) {
          cases.push({
            index,
            hidden: test.hidden === true,
            passed: false,
            input: display(test.args),
            expected: display(test.expected),
            actual: null,
            error: 'The whole run exceeded its 45s budget.',
            durationMs: 0,
          })
          continue
        }
        const caseStarted = Date.now()
        const args = language === 'cpp' ? [...baseArgs, String(index)] : baseArgs
        const result = await collect({
          command,
          args,
          cwd: dir,
          input: language === 'cpp' ? undefined : JSON.stringify(test.args),
          timeoutMs,
          env,
        })
        const elapsed = Date.now() - caseStarted
        let actual
        let error = null
        if (result.timedOut) {
          error = `Time limit exceeded (${Math.round(timeoutMs / 1000)}s).`
        } else if (result.overflow) {
          error = 'Output exceeded 4 MB.'
        } else {
          const stdout = result.stdout.trim()
          if (stdout === '') {
            error =
              result.status === 0
                ? 'The runner produced no output.'
                : `Process exited with ${result.signal ? `signal ${result.signal}` : `code ${result.status}`}.`
            if (result.stderr.trim()) error += `\n${result.stderr.trim().slice(0, 1500)}`
          } else {
            try {
              const parsed = JSON.parse(stdout)
              if (parsed && typeof parsed === 'object' && typeof parsed.__lc_error === 'string') {
                error = parsed.__lc_error
              } else {
                actual = parsed
              }
            } catch {
              error = `Runner output was not JSON.\n${stdout.slice(0, 1000)}`
            }
          }
        }
        const passed =
          error === null &&
          test.expected !== undefined &&
          matches(actual, test.expected, {
            tolerance: 1e-6,
            unordered: compare === 'unordered',
          })
        cases.push({
          index,
          hidden: test.hidden === true,
          passed,
          input: display(test.args),
          expected: test.expected === undefined ? null : display(test.expected),
          actual: actual === undefined ? null : display(actual),
          error: error ?? (passed ? null : 'Wrong answer.'),
          durationMs: elapsed,
        })
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }

  return {
    language,
    passed: cases.filter((c) => c.passed).length,
    total: tests.length,
    compileError,
    cases,
    durationMs: Date.now() - started,
  }
}

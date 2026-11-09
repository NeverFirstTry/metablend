// A test whose only check of an app/ line is a source-text match passes while the text is there,
// not while the code works: on 2026-11-09 a regex pinned a route line that threw on every cache
// miss, and the forecast API answered 500 until a revert. This guard flags each test() that reads
// an app/ JS file from disk and asserts on its text (a regex, includes() or .test()) while it
// renders, calls or requests nothing from app/. Narrow on purpose: CSS, lib/ code and tests that
// also exercise the app/ code are not its business.
// Opt out inside the test (or on the line above it) with `// source-match-ok: <reason>`, a reason
// of at least three words, for checks a behaviour test cannot make (a legal text pinned word for
// word, a scan over every file for a banned character).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SELF = 'lib/source-match.test.js'

// a string literal naming an app/ JS file; `import(` or `from` in front makes it an import, not a read
const APP_FILE = /(import\(\s*|from\s+)?(['"`])[^'"`\n]*\bapp\/[^'"`\n]*\.(?:jsx?|mjs|tsx?)\2/g
const TEXT_ASSERT = /assert\.match\(|assert[\w.]*\([^\n]*?(?:\.includes\(|\.test\(|\.match\()/
// a ban (the text must NOT be there) pins no line: doesNotMatch, `…, false`, `assert(!…)`
const BAN = /doesNotMatch\(|\bfalse\s*[,)]|assert(?:\.ok)?\(\s*!/
const OPT_OUT = /\/\/\s*source-match-ok:([^\n]*)/

export function flagged(text) {
  if (!/readFile|readdirSync/.test(text)) return []
  const starts = [...text.matchAll(/^test\(/gm)].map(m => m.index)
  if (!starts.length) return []
  const prelude = text.slice(0, starts[0])
  const preludeLines = prelude.split('\n')
  // names the prelude binds to app/ source text, and names it imports from app/
  const sourceVars = new Set(), appImports = new Set()
  for (const line of preludeLines) {
    for (const m of line.matchAll(APP_FILE)) {
      if (m[1]) {
        const names = line.match(/(?:import|const|let)\s+(?:\{([^}]*)\}|(\w+))/)
        for (const n of (names?.[1] ?? names?.[2] ?? '').split(',')) {
          const name = n.split(':').pop().replace(/\bas\b.*/, '').trim()
          if (name) appImports.add(name)
        }
      } else {
        const v = line.match(/(?:const|let|var)\s+(\w+)\s*=/)
        if (v) sourceVars.add(v[1])
      }
    }
  }
  const uses = (block, names) => [...names].some(n => new RegExp(`\\b${n}\\b`).test(block))
  const out = []
  starts.forEach((start, i) => {
    const block = text.slice(start, starts[i + 1] ?? text.length)
    const name = block.match(/^test\((['"`])((?:\\.|(?!\1).)*)\1/)?.[2] ?? '(unnamed)'
    const literals = [...block.matchAll(APP_FILE)]
    const readsApp = literals.some(m => !m[1]) || uses(block, sourceVars)
    const exercisesApp = literals.some(m => m[1]) || uses(block, appImports) || /\bfetch\(/.test(block)
    if (!readsApp || exercisesApp || !block.split('\n').some(l => TEXT_ASSERT.test(l) && !BAN.test(l))) return
    const optOut = block.match(OPT_OUT) ?? text.slice(0, start).split('\n').at(-2)?.match(OPT_OUT)
    const reason = optOut?.[1].trim() ?? ''
    if (reason.split(/\s+/).filter(Boolean).length >= 3) return
    out.push(`${name}${optOut ? ' (opt-out without a reason)' : ''}`)
  })
  return out
}

test('the guard flags a source-only check of an app/ line, and nothing else', () => {
  const bad = `import { readFileSync } from 'node:fs'
import { helper } from './helper.js'
test('wiring', () => {
  assert.equal(helper(1), 2)
  const home = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')
  assert.match(home, /remember: first/)
})
`
  assert.deepEqual(flagged(bad), ['wiring'], 'a lib/ call does not make an app/ regex a behaviour test')
  const preludeRead = `import { readFileSync } from 'node:fs'
const route = readFileSync(new URL('../app/api/forecast/route.js', import.meta.url), 'utf8')
test('ttl', () => { assert.ok(route.includes('cached.ttl')) })
`
  assert.deepEqual(flagged(preludeRead), ['ttl'], 'a source read in the prelude counts too')
  const exercised = `import { readFileSync } from 'node:fs'
const { GET } = await import('../app/api/forecast/route.js')
const route = readFileSync(new URL('../app/api/forecast/route.js', import.meta.url), 'utf8')
test('route', async () => { assert.equal((await GET(req)).status, 200); assert.ok(route.includes('ttl')) })
`
  assert.deepEqual(flagged(exercised), [], 'calling the app/ code is a behaviour test')
  const css = `import { readFileSync } from 'node:fs'
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
test('slate', () => { assert.ok(css.includes('#0f151b')) })
`
  assert.deepEqual(flagged(css), [], 'CSS is not an app/ code line')
  const ban = `import { readFileSync } from 'node:fs'
test('no countdown', () => {
  const home = readFileSync('app/HomePage.jsx', 'utf8')
  assert.equal(home.includes('<Countdown'), false)
  assert.doesNotMatch(home, /isAppView/)
  assert.ok(!home.includes('<details'))
})
`
  assert.deepEqual(flagged(ban), [], 'a ban pins no line')
  const optOut = reason => `import { readFileSync } from 'node:fs'
test('legal', () => {
  // source-match-ok:${reason}
  assert.ok(readFileSync('app/privacy/content.jsx', 'utf8').includes('Verantwortlicher'))
})
`
  assert.deepEqual(flagged(optOut(' the German legal text is pinned word for word')), [])
  assert.deepEqual(flagged(optOut(' ok')), ['legal (opt-out without a reason)'])
})

test('no test checks an app/ line only by its source text (opt out with a reason: // source-match-ok: …)', () => {
  const files = execFileSync('git', ['ls-files', '*.test.js', '*.test.mjs'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && f !== SELF)
  assert.ok(files.length > 100, `found only ${files.length} test files`)
  const found = files.flatMap(f => flagged(readFileSync(ROOT + f, 'utf8')).map(t => `${f}: ${t}`))
  assert.deepEqual(found, [])
})

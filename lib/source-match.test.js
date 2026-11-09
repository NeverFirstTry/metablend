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
import ts from 'typescript'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SELF = 'lib/source-match.test.js'

// a string naming an app/ JS file
const APP_FILE = /(^|\/)app\/.+\.(?:jsx?|mjs|tsx?)$/
const TEXT_ASSERT = /assert\.match\(|assert[\w.]*\([^\n]*?(?:\.includes\(|\.test\(|\.match\()/
// a ban (the text must NOT be there) pins no line: doesNotMatch, `…, false`, `assert(!…)`
const BAN = /doesNotMatch\(|\bfalse\s*[,)]|assert(?:\.ok)?\(\s*!/
const OPT_OUT = /\/\/\s*source-match-ok:([^\n]*)/

const calleeName = call => ts.isIdentifier(call.expression) ? call.expression.text : ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : ''
const isLiteral = n => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
const walk = (node, fn) => { fn(node); ts.forEachChild(node, c => walk(c, fn)) }
const bindingNames = name => ts.isIdentifier(name) ? [name.text] : name.elements?.flatMap(e => e.name ? bindingNames(e.name) : []) ?? []

// The file is parsed (TypeScript reads plain JS), so a test() generated inside a loop is judged on its
// own, together with the loop header that feeds it, and module-level code between tests belongs to none.
export function flagged(text) {
  if (!/readFile|readdirSync/.test(text)) return []
  const sf = ts.createSourceFile('test.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  // what reads a file: readFileSync / readFile, and module-level helpers built on them
  const readers = new Set(['readFileSync', 'readFile'])
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && /readFile/.test(st.getText(sf))) readers.add(st.name.text)
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations)
      if (ts.isIdentifier(d.name) && d.initializer && ts.isFunctionLike(d.initializer) && /readFile/.test(d.initializer.getText(sf))) readers.add(d.name.text)
  }
  // every string naming an app/ JS file, by what it is handed to: an import, a read, or a plain path
  const kindOf = lit => {
    for (let n = lit.parent; n && !ts.isSourceFile(n); n = n.parent) {
      if (ts.isImportDeclaration(n)) return 'import'
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) return 'import'
      if (ts.isCallExpression(n) && readers.has(calleeName(n))) return 'read'
      if (ts.isBlock(n) || ts.isFunctionLike(n) || ts.isVariableDeclaration(n) || ts.isExpressionStatement(n)) break
    }
    return 'path'
  }
  const literals = []
  walk(sf, n => { if (isLiteral(n) && APP_FILE.test(n.text)) literals.push({ at: n.getStart(sf), kind: kindOf(n) }) })
  // module-level names bound to app/ source text, to app/ modules, or to lists of app/ paths
  const names = { read: new Set(), import: new Set(), path: new Set() }
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && isLiteral(st.moduleSpecifier) && APP_FILE.test(st.moduleSpecifier.text)) {
      const c = st.importClause
      if (c?.name) names.import.add(c.name.text)
      if (c?.namedBindings) (c.namedBindings.elements ?? [c.namedBindings]).forEach(b => names.import.add(b.name.text))
    }
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
      const inside = literals.filter(l => d.initializer && l.at >= d.initializer.getStart(sf) && l.at < d.initializer.end)
      for (const kind of new Set(inside.map(l => l.kind))) bindingNames(d.name).forEach(n => names[kind].add(n))
    }
  }
  const out = []
  walk(sf, call => {
    if (!ts.isCallExpression(call) || !(calleeName(call) === 'test' || (ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression) && call.expression.expression.text === 'test'))) return
    // the test, plus the header of every loop around it
    const ranges = [[call.getStart(sf), call.end]]
    for (let n = call.parent; n && !ts.isSourceFile(n); n = n.parent)
      if (ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isForStatement(n)) ranges.push([n.getStart(sf), n.statement.getStart(sf)])
    const inUnit = at => ranges.some(([s, e]) => at >= s && at < e)
    const unit = ranges.map(([s, e]) => text.slice(s, e)).join('\n')
    const kinds = new Set(literals.filter(l => inUnit(l.at)).map(l => l.kind))
    const uses = set => [...set].some(n => new RegExp(`\\b${n}\\b`).test(unit))
    let dynamicRead = false, dynamicImport = false
    walk(call, n => {
      if (!ts.isCallExpression(n) || !n.arguments.length || isLiteral(n.arguments[0])) return
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicImport = true
      else if (readers.has(calleeName(n))) dynamicRead = true
    })
    const pathsInPlay = kinds.has('path') || uses(names.path)
    const readsApp = kinds.has('read') || uses(names.read) || (pathsInPlay && dynamicRead)
    const exercisesApp = kinds.has('import') || uses(names.import) || (pathsInPlay && dynamicImport) || /\bfetch\(/.test(unit)
    if (!readsApp || exercisesApp || !unit.split('\n').some(l => TEXT_ASSERT.test(l) && !BAN.test(l))) return
    const optOut = unit.match(OPT_OUT) ?? text.slice(0, call.getStart(sf)).split('\n').at(-2)?.match(OPT_OUT)
    const reason = optOut?.[1].trim() ?? ''
    if (reason.split(/\s+/).filter(Boolean).length >= 3) return
    const first = call.arguments[0]
    const name = first && isLiteral(first) ? first.text : first ? first.getText(sf).replace(/^`|`$/g, '') : '(unnamed)'
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
  // tests generated in a loop are judged on their own, together with the loop header that feeds them,
  // and never lend their paths to the test before them
  const loops = `import { readFileSync } from 'node:fs'
import { summarize } from './job-log.js'
test('summarize', () => {
  assert.ok([401, 503].includes(summarize({ status: 401 }).status))
})
const JOBS = [['cleanup', '../app/api/cleanup/route.js'], ['calibrate', '../app/api/calibrate/route.js']]
for (const [job, file] of JOBS) {
  test(\`\${job}: one row\`, async () => {
    const { GET } = await import(file)
    assert.ok([200].includes((await GET(req)).status))
  })
}
const SCREENS = ['app/components/outlook/TabToday.jsx', 'app/components/outlook/Tab7d.jsx']
for (const f of SCREENS) {
  test(\`\${f} sits in TileGrid\`, () => {
    assert.ok(readFileSync(f, 'utf8').includes('<TileGrid>'), f)
  })
}
`
  assert.deepEqual(flagged(loops), ['${f} sits in TileGrid'], 'only the loop that reads app/ sources is flagged')
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

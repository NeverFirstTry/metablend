// No server module in the browser's code. Everything a 'use client' file imports, and what those files import
// in turn, is sent to the visitor. Until 2026-11-21 the app's peak view pulled in the Open-Meteo gate, the
// database client and the error log through one small helper (code audit of 2026-11-20, finding 16:
// PeakView -> lib/hike/blend.js -> lib/weather.js -> lib/open-meteo.js -> lib/supabase.js). Nothing leaked,
// the browser only ever has the public key, but one wrong grant would have been reachable at once.
// This walks the import statements; it does not run the bundler.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_ONLY = ['lib/supabase.js', 'lib/log.js', 'lib/open-meteo.js', 'lib/job-log.js']
const rel = f => relative(ROOT, f).replace(/\\/g, '/')
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(join(dir, e.name)) : /\.jsx?$/.test(e.name) ? [join(dir, e.name)] : []))
const isClient = src => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*['"]use client['"]/.test(src)
const file = p => [p, `${p}.js`, `${p}.jsx`, join(p, 'index.js'), join(p, 'index.jsx')].find(c => existsSync(c) && statSync(c).isFile())
const importsOf = f => [...readFileSync(f, 'utf8').matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)]
  .map(m => m[1])
  .map(s => (s.startsWith('@/') ? file(join(ROOT, s.slice(2))) : s.startsWith('.') ? file(resolve(dirname(f), s)) : null))
  .filter(Boolean)

test('no file a client component imports, directly or through others, is a server module', () => {
  const roots = files(join(ROOT, 'app')).filter(f => isClient(readFileSync(f, 'utf8')))
  assert.ok(roots.length > 20, `found only ${roots.length} client files: the search is broken`)
  const found = []
  const seen = new Set()
  const walk = (f, path) => {
    if (SERVER_ONLY.includes(rel(f))) { found.push(path.concat(rel(f)).join(' -> ')); return }
    if (seen.has(f)) return
    seen.add(f)
    for (const next of importsOf(f)) walk(next, path.concat(rel(f)))
  }
  for (const r of roots) walk(r, [])
  assert.deepEqual(found, [], `server code would be sent to the browser:\n${found.join('\n')}`)
})

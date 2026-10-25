import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Vercel bundles routes with different settings (maxDuration, memory,
// runtime) into separate functions, and each function starts its own cold
// instances. With little traffic, seven settings meant seven pools going cold
// on their own — about half of all requests paid a cold start. So every route
// shares the default (300 s on Fluid; our upstream calls time out on their
// own long before that).
const APP = fileURLToPath(new URL('../app/', import.meta.url))
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name)
  return e.isDirectory() ? files(p) : /^(route|page|layout)\.jsx?$/.test(e.name) ? [p] : []
})

test('no route sets its own maxDuration, runtime or memory — they all share one function', () => {
  const odd = files(APP).filter(p => /export const (maxDuration|runtime|preferredRegion)\s*=/.test(fs.readFileSync(p, 'utf8')))
  assert.deepEqual(odd.map(p => path.relative(APP, p)), [])
})

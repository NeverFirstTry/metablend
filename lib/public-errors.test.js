import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// lastUpstreamFailure() is the warm instance's last failed upstream call —
// host, status and 200 characters of the upstream's reply, from whoever's
// request that was. It belongs in error_log (logError), never in a public
// answer: a 502 to one visitor must not carry another visitor's failure.
const API = fileURLToPath(new URL('../app/api/', import.meta.url))
const routes = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name)
  return e.isDirectory() ? routes(p) : e.name === 'route.js' ? [p] : []
})

test('no API route puts the upstream failure detail into a response body', () => {
  const leaking = routes(API).filter(p => /(noStore|Response\.json)\(\{[^}]*upstream/.test(fs.readFileSync(p, 'utf8')))
  assert.deepEqual(leaking.map(p => path.relative(API, p)), [])
})

// GET /api/health/db: the database's size has an address of its own, so the main health check never fails
// for it (owner, 2026-11-20: a main check that fails on purpose spoils the uptime figures and can set off the
// deploy guard and a rollback). A second outside monitor asks this one: 200 below 400 MB of the plan's
// 500 MB, 503 from 400 MB on, and 503 when the size cannot be read. The route is called for real with the
// database call faked.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith, json } from './test-route-fakes.js'

const { GET } = await import('../app/api/health/db/route.js')
const MB = 1024 * 1024
const NOW = Date.parse('2026-11-21T12:00:00Z')
// the route keeps its answer a minute per server: every test starts ten minutes after the one before
const clock = (t, n) => t.mock.timers.enable({ apis: ['Date'], now: NOW + n * 600_000 })
const size = answer => call => (call.url.includes('/rest/v1/rpc/database_size') ? answer : undefined)
const reads = () => seen.filter(c => c.url.includes('/rest/v1/rpc/database_size')).length
const ask = (ip = '203.0.113.90') => GET(new Request('https://metablend.app/api/health/db', { headers: { 'x-forwarded-for': ip } }))

test('348 MB: 200 and ok, the size and the two limits, never cached, nothing else in the answer', async t => {
  clock(t, 0); reset(); answerWith(size(json(348 * MB)))
  const res = await ask()
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await res.json(), { ok: true, databaseMb: 348, alarmMb: 400, planMb: 500, checked: '2026-11-21T12:00:00.000Z' })
})

test('400 MB: 503, the monitor sends its mail', async t => {
  clock(t, 1); reset(); answerWith(size(json(400 * MB)))
  const res = await ask()
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.ok, false)
  assert.equal(body.databaseMb, 400)
})

test('the size cannot be read: 503 without a size, never "all is well"', async t => {
  clock(t, 2); reset(); answerWith(size(json({ message: 'no answer' }, 500)))
  const res = await ask()
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.ok, false)
  assert.equal(body.databaseMb, null)
})

test('an answer is kept a minute per server: asked twice, the database is read once', async t => {
  clock(t, 3); reset(); answerWith(size(json(348 * MB)))
  await ask(); await ask('203.0.113.91')
  assert.equal(reads(), 1)
  t.mock.timers.tick(61_000)
  await ask()
  assert.equal(reads(), 2)
})

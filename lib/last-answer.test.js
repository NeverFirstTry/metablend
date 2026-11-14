// lib/last-answer.js on its own: what is sent to the database, what comes back, and that neither
// keeping nor reading ever throws (a forecast must not fail over its spare copy).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync, gzipSync } from 'node:zlib'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { keepAnswer, lastAnswer, keptResponse, placeKey, asker, addedCount, KEEP_MS, KEPT_TTL, NEW_PER_HOUR } = await import('./last-answer.js')
const { sweepAll } = await import('./ratelimit.js')
const NOW = Date.parse('2026-11-20T10:00:00Z')
const pack = body => gzipSync(JSON.stringify(body)).toString('base64')
// a stand-in for the database client that records the read's filters
const reader = (data, log = {}) => ({ from: () => ({ select: () => ({ eq: (k, v) => ({ eq: (k2, v2) => ({ gte: (k3, v3) => ({ limit: async () => { Object.assign(log, { [k]: v, [k2]: v2, [k3]: v3 }); return { data } } }) }) }) }) }) })

test('placeKey: the rounded place, three decimals unless said otherwise', () => {
  assert.equal(placeKey(48.20849, 16.37208), '48.208,16.372')
  assert.equal(placeKey(47.8, 13.04, 2), '47.80,13.04')
})

test('keepAnswer: the answer goes compressed to the function, without a limit (the rooms are the database\'s); a failing database is swallowed', async () => {
  const calls = []
  await keepAnswer('outlook', '48.209,16.372', { days: [1, 2] }, { db: { rpc: async (fn, args) => { calls.push([fn, args]) } } })
  assert.equal(calls[0][0], 'keep_last_answer')
  assert.deepEqual(Object.keys(calls[0][1]), ['p_kind', 'p_place', 'p_body'])
  assert.deepEqual([calls[0][1].p_kind, calls[0][1].p_place], ['outlook', '48.209,16.372'])
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(calls[0][1].p_body, 'base64')).toString()), { days: [1, 2] })
  await keepAnswer('rain', 'x', {}, { db: { rpc: async () => { throw new Error('no database') } } })
})

// the review of 2026-11-14: one client could write a room full of made-up places and have them count as in use
test('keepAnswer: one visitor address adds only so many new places an hour and kind; after that its places are sent with no room, which still renews what is kept', async () => {
  const sent = []
  // the database's answer: true for a place that had no row, false for a renewal
  const db = { rpc: async (fn, args) => { sent.push(args); return { data: !args.p_place.startsWith('kept') && args.p_max !== 0 } } }
  const T = NOW, room = () => sent.at(-1).p_max
  for (let i = 0; i < NEW_PER_HOUR; i++) await keepAnswer('rain', `new-${i}`, {}, { db, by: '203.0.113.7', now: T })
  assert.ok(sent.every(a => !('p_max' in a)), 'its share: sent as always')
  await keepAnswer('rain', 'one-more', {}, { db, by: '203.0.113.7', now: T + 60_000 })
  assert.equal(room(), 0, 'beyond its share: no room for a new place')
  await keepAnswer('rain', 'kept-already', {}, { db, by: '203.0.113.7', now: T + 60_000 })
  assert.equal(room(), 0, 'the database renews a place already kept even then (supabase/last-answers.test.js)')
  await keepAnswer('summit', 'another-kind', {}, { db, by: '203.0.113.7', now: T + 60_000 })
  assert.equal(room(), undefined, 'counted per kind')
  await keepAnswer('rain', 'somebody-else', {}, { db, by: '203.0.113.8', now: T + 60_000 })
  assert.equal(room(), undefined, 'and per address')
  await keepAnswer('rain', 'an-hour-later', {}, { db, by: '203.0.113.7', now: T + 3600_001 })
  assert.equal(room(), undefined, 'the hour is over')
  // renewals do not count: a busy place's rebuilds never use up an address's share
  for (let i = 0; i < 3 * NEW_PER_HOUR; i++) await keepAnswer('outlook', 'kept-town', {}, { db, by: '203.0.113.9', now: T })
  await keepAnswer('outlook', 'new-town', {}, { db, by: '203.0.113.9', now: T })
  assert.equal(room(), undefined)
  // nobody named (a caller outside the routes): never limited
  for (let i = 0; i < 2 * NEW_PER_HOUR; i++) await keepAnswer('forecast', `n-${i}`, {}, { db, now: T })
  assert.equal(room(), undefined)
})

test('keepAnswer: an address leaves memory when its hour is over (the privacy notice: counted for at most an hour, not stored)', async () => {
  const db = { rpc: async () => ({ data: true }) }
  await keepAnswer('rain', 'a-place', {}, { db, by: '203.0.113.50', now: NOW })
  assert.ok(addedCount() >= 1)
  sweepAll(NOW + 3599_000)
  assert.ok(addedCount() >= 1, 'still counted within its hour')
  sweepAll(NOW + 2 * 3600_000 + 120_000) // past every count the tests above started
  assert.equal(addedCount(), 0)
})

test('asker: the visitor\'s address; our own jobs and pages (they carry the site\'s key) share one count', () => {
  process.env.CALIBRATE_SECRET = 'calibrate-secret'
  const req = headers => new Request('https://metablend.app/api/nowcast', { headers })
  assert.equal(asker(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })), '203.0.113.7')
  assert.equal(asker(req({ 'x-forwarded-for': '203.0.113.7', 'x-calibrate-key': 'calibrate-secret' })), 'own')
  assert.equal(asker(req({ 'x-forwarded-for': '203.0.113.7', 'x-calibrate-key': 'guessed' })), '203.0.113.7')
})

test('lastAnswer: the kept answer with its time; asked only as far back as the kind allows', async () => {
  const log = {}
  const got = await lastAnswer('rain', '47.81,13.04', { db: reader([{ body: pack({ steps: [1] }), made_at: '2026-11-20T09:30:00+00:00' }], log), now: NOW })
  assert.deepEqual(got, { body: { steps: [1] }, madeAt: '2026-11-20T09:30:00+00:00' })
  assert.deepEqual(log, { kind: 'rain', place: '47.81,13.04', made_at: new Date(NOW - KEEP_MS.rain).toISOString() })
  await lastAnswer('outlook', 'p', { db: reader([], log), now: NOW })
  assert.equal(log.made_at, new Date(NOW - 24 * 3600_000).toISOString())
})

test('lastAnswer: nothing kept, an unreadable row, no table or no database are all "nothing"', async () => {
  assert.equal(await lastAnswer('summit', 'p', { db: reader([]), now: NOW }), null)
  assert.equal(await lastAnswer('summit', 'p', { db: reader(null), now: NOW }), null)
  assert.equal(await lastAnswer('summit', 'p', { db: reader([{ body: 'not gzip', made_at: 'x' }]), now: NOW }), null)
  assert.equal(await lastAnswer('summit', 'p', { db: { from: () => { throw new Error('no database') } }, now: NOW }), null)
})

test('keptResponse: marked with when it was made, and the CDN keeps it only briefly', async () => {
  const res = keptResponse({ days: [] }, '2026-11-20T09:30:00+00:00')
  assert.equal(res.headers.get('cache-control'), `public, s-maxage=${KEPT_TTL}`)
  assert.deepEqual(await res.json(), { days: [], kept: '2026-11-20T09:30:00+00:00' })
})

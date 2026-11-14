// lib/last-answer.js on its own: what is sent to the database, what comes back, and that neither
// keeping nor reading ever throws (a forecast must not fail over its spare copy).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync, gzipSync } from 'node:zlib'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { keepAnswer, lastAnswer, keptResponse, placeKey, KEEP_MS, KEPT_TTL } = await import('./last-answer.js')
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

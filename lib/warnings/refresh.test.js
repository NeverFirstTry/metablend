import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { refreshAll, applyPending, refreshWarnings } from './refresh.js'
import { trimFeed } from './trim.js'

const germany = JSON.parse(fs.readFileSync(new URL('./__fixtures__/feed-germany.json', import.meta.url), 'utf8'))
const NOW = Math.min(...germany.warnings.map(w => Date.parse(w.alert.sent)))

test('refreshAll — every feed parsed and saved under its country', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['germany', 'DE'], ['austria', 'AT']],
    fetchFeed: async slug => (slug === 'germany' ? germany : { warnings: [] }),
    save: async (country, rows, at) => { saved.push([country, rows.length, at]) },
    now: NOW,
  })
  assert.deepEqual(saved.map(s => s[0]).sort(), ['AT', 'DE'])
  assert.ok(saved.find(s => s[0] === 'DE')[1] > 0)
  assert.equal(saved.find(s => s[0] === 'AT')[1], 0) // an empty feed clears that country
  assert.ok(saved.every(s => s[2] === NOW))
  assert.deepEqual(summary.failed, [])
  assert.equal(summary.countries, 2)
})

test('refreshAll — a failed feed keeps that country\'s rows (no save) and the rest still refresh', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['germany', 'DE'], ['spain', 'ES'], ['italy', 'IT']],
    fetchFeed: async slug => (slug === 'spain' ? null : slug === 'italy' ? Promise.reject(new Error('timeout')) : germany),
    save: async country => { saved.push(country) },
    now: NOW,
  })
  assert.deepEqual(saved, ['DE'])
  assert.deepEqual(summary.failed.map(f => f[0]).sort(), ['ES', 'IT'])
})

test('refreshAll — a failing save counts as failed, never throws', async () => {
  const summary = await refreshAll({
    feeds: [['germany', 'DE']], fetchFeed: async () => germany,
    save: async () => { throw new Error('db down') }, now: NOW,
  })
  assert.deepEqual(summary.failed, [['DE', 'db down']])
})

test('refreshAll — an answer without a warnings list (maintenance page) counts as failed and keeps the rows', async () => {
  const saved = []
  const summary = await refreshAll({
    feeds: [['spain', 'ES'], ['germany', 'DE']],
    fetchFeed: async slug => (slug === 'spain' ? { message: 'Service under maintenance' } : germany),
    save: async country => { saved.push(country) },
    now: NOW,
  })
  assert.deepEqual(saved, ['DE'])
  assert.deepEqual(summary.failed.map(f => f[0]), ['ES'])
})

test('applyPending — the countries the database found changed: parsed from the trimmed feed, saved, then marked done', async () => {
  const saved = [], done = []
  const summary = await applyPending({
    pending: [{ country: 'DE', hash: 'h1', body: trimFeed(germany, NOW - 3600e3) }, { country: 'AT', hash: 'h2', body: { warnings: [] } }],
    save: async (country, rows, at) => { saved.push([country, rows.length, at]) },
    markDone: async (country, hash) => { done.push([country, hash]) },
    now: NOW,
  })
  assert.deepEqual(saved.map(s => s[0]), ['DE', 'AT'])
  assert.ok(saved[0][1] > 0)
  assert.equal(saved[1][1], 0) // a feed with nothing in force clears that country, as before
  assert.deepEqual(done, [['DE', 'h1'], ['AT', 'h2']])
  assert.deepEqual(summary, { countries: 2, warnings: saved[0][1], failed: [] })
})

test('applyPending — a country whose save fails stays pending (not marked done) and the others go on', async () => {
  const done = []
  const summary = await applyPending({
    pending: [{ country: 'DE', hash: 'h1', body: { warnings: [] } }, { country: 'AT', hash: 'h2', body: { warnings: [] } }],
    save: async country => { if (country === 'DE') throw new Error('db down') },
    markDone: async (country, hash) => { done.push([country, hash]) },
    now: NOW,
  })
  assert.deepEqual(done, [['AT', 'h2']])
  assert.deepEqual(summary.failed, [['DE', 'db down']])
})

// One refresh run as the route wires it: the database's answers (PostgREST
// { data, error }) decide what this run parses and what it downloads itself.
const FEEDS = [['germany', 'DE'], ['austria', 'AT'], ['spain', 'ES']]
function run({ behind, pending = { data: [], error: null }, now = NOW }) {
  const fetched = [], saved = [], logged = [], done = []
  const result = refreshWarnings({
    readBehind: async () => behind,
    readPending: async () => pending,
    markDone: async (country, hash) => { done.push([country, hash]) },
    feeds: FEEDS,
    fetchFeed: async slug => { fetched.push(slug); return { warnings: [] } },
    save: async country => { saved.push(country) },
    log: async (scope, message, meta) => { logged.push([scope, message, meta]) },
    now,
  })
  return { result, fetched, saved, logged, done }
}
const AT_HOUR = Date.parse('2026-10-26T13:00:20Z') // the run on the hour

test('refreshWarnings — before the database part exists (no such view) it downloads every feed itself', async () => {
  for (const code of ['PGRST205', '42P01']) {
    const r = run({ behind: { data: null, error: { code, message: 'relation does not exist' } } })
    const summary = await r.result
    assert.deepEqual(r.fetched, ['germany', 'austria', 'spain'])
    assert.equal(summary.source, 'download')
    assert.equal(summary.countries, 3)
  }
})

test('refreshWarnings — any other database error fails the run (logged as an error), never a quiet 19 MB download', async () => {
  const r = run({ behind: { data: null, error: { code: '42501', message: 'permission denied' } } })
  await assert.rejects(r.result, /permission denied/)
  assert.deepEqual(r.fetched, [])
})

test('refreshWarnings — the feeds the database found changed are applied; nothing is downloaded while no feed is behind', async () => {
  const r = run({ behind: { data: [], error: null }, pending: { data: [{ country: 'AT', hash: 'h', body: { warnings: [] } }], error: null } })
  const summary = await r.result
  assert.deepEqual(r.fetched, [])
  assert.deepEqual(r.saved, ['AT'])
  assert.deepEqual(r.done, [['AT', 'h']])
  assert.deepEqual(r.logged, [])
  assert.equal(summary.source, 'database')
})

test('refreshWarnings — feeds the database could not get lately are downloaded here, after the pending ones, and that is logged', async () => {
  const r = run({
    behind: { data: [{ country: 'ES', last_status: 503, last_error: 'HTTP 503' }], error: null },
    pending: { data: [{ country: 'AT', hash: 'h', body: { warnings: [] } }], error: null },
    now: AT_HOUR,
  })
  const summary = await r.result
  assert.deepEqual(r.fetched, ['spain'])
  assert.deepEqual(r.saved, ['AT', 'ES'])
  assert.equal(r.logged.length, 1)
  assert.equal(r.logged[0][0], 'warnings.database')
  assert.deepEqual(r.logged[0][2].feeds, [['ES', 503, 'HTTP 503']])
  assert.equal(summary.countries, 2)
  assert.deepEqual(summary.downloaded, ['ES'])
})

test('refreshWarnings — late feeds are still downloaded every run, but logged only on the run on the hour', async () => {
  for (const at of ['13:15:20', '13:30:20', '13:45:20']) {
    const r = run({ behind: { data: [{ country: 'ES', last_status: null, last_error: 'SSL_ERROR_SYSCALL' }], error: null }, now: Date.parse(`2026-10-26T${at}Z`) })
    await r.result
    assert.deepEqual(r.fetched, ['spain'], at)
    assert.deepEqual(r.logged, [], at)
  }
})

test('refreshWarnings — a pending-feeds read error fails the run instead of skipping it quietly', async () => {
  const r = run({ behind: { data: [], error: null }, pending: { data: null, error: { code: '57014', message: 'canceling statement' } } })
  await assert.rejects(r.result, /canceling statement/)
})

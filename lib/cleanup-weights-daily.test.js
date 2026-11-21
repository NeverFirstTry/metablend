// The nightly job keeps the weights of the day (owner, 2026-11-21, for the shadow run's final report of 5 December:
// today's formula could not be replayed because the weights of each day were not kept). One row per region and
// day in weights_daily (supabase/weights-daily.sql); the table may not exist yet: the job then runs as before.
// The route is called for real with every outside call faked.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith, json, jobRequest } from './test-route-fakes.js'

const { GET: cleanup } = await import('../app/api/cleanup/route.js')
const WEIGHTS = [{ id: 'icon', region: 'europe', weight: 0.06 }, { id: 'ecmwf', region: 'europe', weight: 0.04 }, { id: 'gfs', region: 'north_america', weight: 0.07 }]
const writes = () => seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/weights_daily'))
const notes = () => seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/error_log') && /weights-daily/.test(c.body ?? ''))

test('one row per region with the day and its weights', async () => {
  reset(); answerWith(call => (call.method === 'GET' && call.url.includes('/rest/v1/api_weights?select=id,region,weight') ? json(WEIGHTS) : undefined))
  const res = await cleanup(jobRequest('/api/cleanup'))
  assert.equal(res.status, 200)
  assert.equal(writes().length, 1)
  const rows = JSON.parse(writes()[0].body)
  const day = new Date().toISOString().slice(0, 10)
  assert.deepEqual(rows, [
    { day, region: 'europe', weights: { icon: 0.06, ecmwf: 0.04 } },
    { day, region: 'north_america', weights: { gfs: 0.07 } },
  ])
  // a second run on the same day changes nothing: duplicates are left alone
  assert.match(writes()[0].url, /on_conflict=day,region/)
})

test('the table is not in the database yet: the job runs as before and leaves no note', async () => {
  reset(); answerWith(call => (call.url.includes('/rest/v1/api_weights?select=id,region,weight') ? json(WEIGHTS)
    : call.url.includes('/rest/v1/weights_daily') ? json({ code: 'PGRST205', message: "Could not find the table 'public.weights_daily'" }, 404) : undefined))
  const res = await cleanup(jobRequest('/api/cleanup'))
  assert.equal(res.status, 200)
  assert.equal(notes().length, 0)
})

test('no weights could be read: nothing is written', async () => {
  reset(); answerWith(call => (call.url.includes('/rest/v1/api_weights?select=id,region,weight') ? json([]) : undefined))
  assert.equal((await cleanup(jobRequest('/api/cleanup'))).status, 200)
  assert.equal(writes().length, 0)
})

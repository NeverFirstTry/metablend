// The outlook's scoring, steps 1 to 3 (plan of 2026-11-10). On 2026-11-12 the job asked 40 stations in
// one request, the service cut the answer at 400 reports, 11,689 of 14,843 predictions were overdue and
// two thirds of the decided ones had run out without a score.
import '../test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith, json } from '../test-route-fakes.js'
// loaded after the hooks above: the job reads the airport list (JSON) and the database client
const { fetchMetarHistory, METAR_PER_REQUEST } = await import('./job.js')
const { saveSnapshots, SLOT_PLACES } = await import('./snapshots.js')
import { hourlySlot } from './checkpoints.js'
import { addDays } from '../localtime.js'

test('step 1: two stations a request, so 72 hours fit under the service’s limit of 400 reports', async () => {
  const asked = [], waits = []
  const get = async url => { asked.push(new URL(url).searchParams.get('ids')); return { ok: true, json: async () => (asked.length === 2 ? Array.from({ length: 400 }, () => ({})) : [{ icaoId: 'X' }]) } }
  const out = await fetchMetarHistory(['LOWW', 'LOWS', 'LOWI', 'LOWG', 'LOWK'], { get, pause: async ms => { waits.push(ms) } })
  assert.equal(METAR_PER_REQUEST, 2)
  assert.deepEqual(asked, ['LOWW,LOWS', 'LOWI,LOWG', 'LOWK'])
  assert.equal(out.requests, 3)
  assert.equal(out.truncated, 1, 'an answer full to the limit is counted')
  assert.equal(out.metars.length, 402)
  assert.deepEqual(waits, [750, 750], 'a pause between requests, none before the first')
})

test('step 1: after the time budget the rest of the stations waits for the next night', async () => {
  let t = 0
  const out = await fetchMetarHistory(['A', 'B', 'C', 'D', 'E', 'F'], { get: async () => ({ ok: true, json: async () => [] }), pause: async () => { t += 160_000 }, clock: () => t })
  assert.deepEqual([out.requests, out.left], [2, 2], 'two requests fit the budget, two stations are left')
})

test('step 1: a 429 from the service ends the night’s requests at once', async () => {
  let n = 0
  const out = await fetchMetarHistory(['A', 'B', 'C', 'D', 'E', 'F'], { get: async () => (++n === 2 ? { ok: false, status: 429 } : { ok: true, status: 200, json: async () => [{}] }), pause: async () => {} })
  assert.deepEqual([out.requests, out.left, out.metars.length], [2, 4, 1])
})

const TODAY = '2026-11-12', NOW = Date.parse('2026-11-12T10:00:00Z')
const series = [{ id: 'ecmwf', daily: [{ date: addDays(TODAY, 1), max: 5, min: 1, pop: 10, precip: 0 }] }]
const vienna = { city: 'Wien', lat: 48.2082, lon: 16.3738, region: 'europe', series, utcOffsetSec: 3600, todayLocal: TODAY, now: NOW }
const writes = () => seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/outlook_snapshots')).length
const reads = () => seen.filter(c => c.method === 'GET' && c.url.includes('/rest/v1/outlook_snapshots')).length

test('step 2: a place with no airport within 60 km is not saved, and the database is not even asked', async () => {
  reset()
  assert.equal(await saveSnapshots({ ...vienna, city: 'Mid-Pacific', lat: 0, lon: -150 }), 0)
  assert.equal(reads() + writes(), 0)
})

test('step 3: a region’s 6-hour slot takes 20 places; the twenty-first is not saved, a place already in it still is', async () => {
  assert.equal(SLOT_PLACES, 20)
  const slot = hourlySlot(NOW)
  const inSlot = n => Array.from({ length: n }, (_, i) => ({ city: `Ort ${i}` }))
  // room left: saved
  reset(); answerWith(({ url, method }) => (method !== 'GET' || !url.includes('/rest/v1/outlook_snapshots') ? undefined : url.includes('select=city') ? json(inSlot(19)) : json([])))
  assert.equal(await saveSnapshots(vienna), 1)
  assert.equal(writes(), 1)
  assert.ok(seen.some(c => c.url.includes('select=city') && c.url.includes(`slot=eq.${slot}`) && c.url.includes('region=eq.europe')), 'the slot of this region is counted')
  // full: not saved
  reset(); answerWith(({ url, method }) => (method !== 'GET' || !url.includes('/rest/v1/outlook_snapshots') ? undefined : url.includes('select=city') ? json(inSlot(20)) : json([])))
  assert.equal(await saveSnapshots(vienna), 0)
  assert.equal(writes(), 0)
  // already in this slot: its other snapshot (the day's) is still saved, without counting again
  reset(); answerWith(({ url, method }) => (method !== 'GET' || !url.includes('/rest/v1/outlook_snapshots') ? undefined : url.includes('select=city') ? json(inSlot(20)) : json([{ kind: 'h', slot }])))
  assert.equal(await saveSnapshots(vienna), 1)
  assert.ok(!seen.some(c => c.url.includes('select=city')), 'no count for a place that is in')
})

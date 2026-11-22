// The night's scoring shares Visual Crossing's 1,000 records a day with the live forecasts, and the forecasts
// come first (owner, 2026-11-21: "confirm the Visual Crossing budget of 1,000 records a day still covers the
// live forecasts together with the nightly scoring, not only the scoring alone"). A fixed 720 for the night did
// not: on 2026-11-16 the forecasts asked 447 times. The route is called for real with every outside call faked
// (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { json, seen, answerWith, reset, jobRequest } from './test-route-fakes.js'

const PLACES = ['Wien', 'Graz', 'Linz', 'Lienz']
// Visual Crossing's answer for a day with its hours: 24 records
const DAY = { queryCost: 24, tzoffset: 1, days: [{ hours: Array.from({ length: 24 }, (_, h) => ({ datetime: `${String(h).padStart(2, '0')}:00:00`, temp: 10 })) }] }

// One run of the job: four places were looked at yesterday. `live` is how many forecasts the last 24 hours
// built (the database's count of history rows); null: the count cannot be read.
async function run(live) {
  process.env.VISUAL_CROSSING_KEY = 'vc-key'
  const { GET } = await import('../app/api/calibrate/route.js')
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  reset()
  answerWith(({ url, method }) => {
    if (method === 'HEAD' && url.includes('/rest/v1/consensus_history?')) return live == null ? new Response(null, { status: 500 }) : new Response(null, { status: 200, headers: { 'content-range': `0-0/${live}` } })
    if (method === 'GET' && url.includes('/rest/v1/forecasts?')) return json(PLACES.map((city, i) => ({ city, lat: 46 + i, lon: 14, api_id: 'open-meteo', temp: 10, region: 'europe', created_at: `${yesterday}T12:00:00+00:00` })))
    // the day's claim (lib/weights.js claimDay): nobody holds it, the insert gives the row, and it is the first
    if (method === 'POST' && url.includes('/rest/v1/feedback')) return json({ id: 7 }, 201)
    if (method === 'GET' && url.includes('/rest/v1/feedback?') && url.includes('order=')) return json([{ id: 7 }])
    if (url.includes('weather.visualcrossing.com')) return json(DAY)
  })
  const res = await GET(jobRequest('/api/calibrate'))
  delete process.env.VISUAL_CROSSING_KEY
  return { status: res.status, body: await res.json(), asked: seen.filter(c => c.url.includes('weather.visualcrossing.com')).length, count: seen.find(c => c.method === 'HEAD' && c.url.includes('consensus_history')) }
}

test('a busy day leaves the night little: as many places as the forecasts and the reserve leave', async () => {
  const { status, body, asked, count } = await run(800)
  assert.equal(status, 200)
  assert.equal(body.live, 800)
  assert.equal(body.budget, 50, '1,000 less 800 forecasts less the reserve of 150')
  assert.equal(asked, 2, '50 records are two places of 24')
  assert.equal(body.records, 48)
  assert.equal(body.left, 2, 'the two places not reached are counted')
  const since = Date.parse(count.url.match(/created_at=gte\.([^&]+)/)[1])
  assert.ok(Math.abs(Date.now() - 86_400_000 - since) < 60_000, 'the forecasts counted are those of the last 24 hours')
})

test('a day that needs the allowance for its forecasts: Visual Crossing is not asked that night', async () => {
  const { status, body, asked } = await run(900)
  assert.equal(status, 200)
  assert.equal(body.budget, 0)
  assert.equal(asked, 0)
  assert.equal(body.left, 4)
})

test('the count cannot be read: the night plans for a busy day, 450 forecasts', async () => {
  const { body, asked } = await run(null)
  assert.equal(body.live, 450)
  assert.equal(body.budget, 400)
  assert.equal(asked, 4, 'four places fit')
  assert.equal(body.left, 0)
})

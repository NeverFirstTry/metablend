// A route's heights are asked once and kept (lib/route/height-store.js). On 2026-11-12 a walk through
// twenty peaks asked every point of every route and cost 22,705 elevation calls in an hour.
import '../test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith } from '../test-route-fakes.js'
import { sampleIndexes, lineKey, routeHeights, dailyBudget, SAMPLE_MAX, LIVE_MAX_KM, DAILY_POINTS, oneWayKm } from './height-store.js'

// a straight line of n points, `step` degrees of latitude apart (0.0003 is about 33 m)
const line = (n, step = 0.0003, lat0 = 47) => Array.from({ length: n }, (_, i) => ({ lat: lat0 + i * step, lon: 13, ele: null }))
// the route_heights table as a map, with the two calls the store makes
function fakeDb(rows = new Map()) {
  const db = { rows, writes: 0, from: () => { const f = {}; const q = { select: () => q, eq: (k, v) => { f[k] = v; return q }, maybeSingle: async () => ({ data: rows.get(`${f.route_id}|${f.geom}`) ?? null }), upsert: async r => { rows.set(`${r.route_id}|${r.geom}`, r); db.writes++; return {} } }; return q } }
  return db
}
// the live service: a height for every point asked, and a count of the points
function live() { const s = { points: 0, requests: 0, get: async pts => { s.requests++; s.points += pts.length; return pts.map((p, i) => 1000 + i) } }; return s }

test('the numbers: 100 points a route, 40 km one way, 3,000 points a day', () => {
  assert.deepEqual([SAMPLE_MAX, LIVE_MAX_KM, DAILY_POINTS], [100, 40, 3000])
})

test('sampleIndexes: at most 100 points, evenly along the way, the first and the last among them', () => {
  const idx = sampleIndexes(line(300))
  assert.ok(idx.length <= 100 && idx.length >= 95, `${idx.length} points`)
  assert.deepEqual([idx[0], idx.at(-1)], [0, 299])
  assert.ok(idx.every((v, i) => i === 0 || v > idx[i - 1]), 'in order, none twice')
  assert.ok(Math.max(...idx.slice(1).map((v, i) => v - idx[i])) <= 4, 'no long gap')
  assert.deepEqual(sampleIndexes(line(40)), [...Array(40).keys()])
})

test('a 300-point route asks at most 100 points in one request, once: the second time nothing is asked', async () => {
  const db = fakeDb(), om = live(), points = line(300)
  const first = await routeHeights('osm-1', points, { db, getElevations: om.get })
  assert.ok(om.points <= 100 && om.points >= 95, `${om.points} points asked`)
  assert.equal(om.requests, 1)
  assert.equal(first.asked, om.points)
  assert.ok(first.points.every(p => typeof p.ele === 'number'), 'the points between the samples have heights too')
  assert.equal(db.writes, 1)
  const again = await routeHeights('osm-1', points, { db, getElevations: om.get })
  assert.equal(om.requests, 1, 'nothing asked for a line the store knows')
  assert.equal(again.asked, 0)
  assert.deepEqual(again.points.map(p => Math.round(p.ele)), first.points.map(p => Math.round(p.ele)))
})

test('a route whose line changed gets new heights; the summit keeps the height it came with', async () => {
  const db = fakeDb(), om = live(), points = line(120)
  points.at(-1).ele = 3798
  const a = await routeHeights('osm-2', points, { db, getElevations: om.get })
  assert.equal(a.points.at(-1).ele, 3798)
  assert.equal([...db.rows.values()][0].heights.at(-1), null, 'a height from the request is used, never stored')
  assert.equal(om.points, 99, 'the sample of 100 without the summit: its height is not asked')
  const moved = points.map((p, i) => (i === 60 ? { ...p, lon: 13.01 } : { ...p }))
  assert.notEqual(lineKey(sampleIndexes(moved).map(i => moved[i])), lineKey(sampleIndexes(points).map(i => points[i])))
  await routeHeights('osm-2', moved, { db, getElevations: om.get })
  assert.equal(om.requests, 2)
})

test('a line over 40 km one way is not asked from the live service; heights already stored are used', async () => {
  const db = fakeDb(), om = live(), long = line(300, 0.002)
  assert.ok(oneWayKm(long) > LIVE_MAX_KM)
  const none = await routeHeights('osm-3', long, { db, getElevations: om.get })
  assert.equal(om.requests, 0)
  assert.ok(none.points.every(p => p.ele == null), 'no heights rather than made-up ones')
  const sampled = sampleIndexes(long).map(i => long[i])
  db.rows.set(`osm-3|${lineKey(sampled)}`, { heights: sampled.map((_, i) => 500 + i) })
  const stored = await routeHeights('osm-3', long, { db, getElevations: om.get })
  assert.equal(om.requests, 0)
  assert.ok(stored.points.every(p => typeof p.ele === 'number'))
})

test('heights the route cache already holds for the same places cost nothing and are stored', async () => {
  const db = fakeDb(), om = live(), points = line(250)
  const known = new Map(points.map((p, i) => [`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`, 800 + i]))
  const r = await routeHeights('osm-4', points, { db, getElevations: om.get, known })
  assert.equal(om.requests, 0)
  assert.equal(r.asked, 0)
  assert.equal(db.writes, 1)
  assert.equal(r.points[0].ele, 800)
})

test('heights a client sends are never written to the shared store, and the next caller is not served them', async () => {
  const db = fakeDb(), om = live(), honest = line(80)
  const forged = honest.map(p => ({ ...p, ele: 9000 }))
  const mine = await routeHeights('saved', forged, { db, getElevations: om.get })
  assert.ok(mine.points.every(p => p.ele === 9000), 'the sender gets back what it sent')
  assert.equal(om.requests, 0)
  assert.ok([...db.rows.values()].every(r => r.heights.every(v => v === null)), 'nothing of it is stored')
  const next = await routeHeights('saved', honest, { db, getElevations: om.get })
  assert.equal(om.requests, 1, 'the next caller is asked from the live service')
  assert.ok(next.points.every(p => p.ele >= 1000 && p.ele < 1100))
})

test('the daily budget: with 2,950 of 3,000 points used today a route of 100 is not asked, one of 50 is', async () => {
  const counter = { from: () => { const q = { select: () => q, eq: () => q, then: (ok) => ok({ data: [{ calls: 2000 }, { calls: 950 }] }) }; return q } }
  const budget = dailyBudget(counter)
  assert.equal(await budget(100), false)
  assert.equal(await budget(50), true)
  assert.equal(await budget(1), false, 'what was just allowed counts at once')
  const db = fakeDb(), om = live()
  const r = await routeHeights('osm-5', line(300), { db, getElevations: om.get, budget: async () => false })
  assert.equal(om.requests, 0)
  assert.ok(r.points.every(p => p.ele == null))
})

test('POST /api/route-heights: a saved route of 500 points asks at most 100, counted as saved-heights', async () => {
  reset()
  answerWith(({ url }) => {
    if (!url.includes('api.open-meteo.com/v1/elevation')) return
    const n = new URL(url).searchParams.get('latitude').split(',').length
    return new Response(JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 900 + i) }), { headers: { 'content-type': 'application/json' } })
  })
  const { POST } = await import('../../app/api/route-heights/route.js')
  const body = { points: line(500, 0.0002).map(p => [p.lat, p.lon, null]) }
  const res = await POST(new Request('https://metablend.app/api/route-heights', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.70', 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  assert.equal(res.status, 200)
  const out = await res.json()
  assert.equal(out.points.length, 500)
  assert.ok(out.points.every(p => typeof p[2] === 'number') && out.heights === true)
  const asked = seen.filter(c => c.url.includes('/v1/elevation')).map(c => new URL(c.url).searchParams.get('latitude').split(',').length)
  assert.equal(asked.length, 1)
  assert.ok(asked[0] <= 100, `${asked[0]} points asked`)
  await new Promise(r => setTimeout(r, 20))
  const bumps = seen.filter(c => c.url.includes('/rpc/bump_open_meteo_calls')).map(c => JSON.parse(c.body))
  assert.deepEqual(bumps.map(b => [b.p_kind, b.p_calls]), [['saved-heights', asked[0]]], 'its own kind, and with it its own daily budget')
})

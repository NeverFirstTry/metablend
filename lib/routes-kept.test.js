// How long a peak's route list is kept before OpenStreetMap is asked again: 30 days (owner, 2026-11-20; it
// was a week). Marked routes rarely change, and asking a public service less is our rule. The price: a route
// that did change shows up to 30 days late. A lookup in which a route failed is still tried again after one
// day. The route is called for real with every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { seen, reset, answerWith, json } from './test-route-fakes.js'

const { GET: routes } = await import('../app/api/routes/route.js')
const fx = name => JSON.parse(fs.readFileSync(new URL(`./route/__fixtures__/${name}`, import.meta.url), 'utf8'))
const DAY = 86400e3
const ask = ip => routes(new Request('https://metablend.app/api/routes?lat=47.0745&lon=12.6941&elev=3798&name=Gro%C3%9Fglockner&v=3', { headers: { 'x-forwarded-for': ip } }))
const osm = () => seen.filter(c => c.url.includes('api.openstreetmap.org'))
// the stored list (a peak with no marked routes, so nothing is left to repair), looked up `days` ago
const stored = days => call => (call.method === 'GET' && call.url.includes('/rest/v1/route_cache') ? json([{ routes: [], fetched_at: new Date(Date.now() - days * DAY).toISOString() }]) : undefined)
// OpenStreetMap as recorded for the Großglockner: the 712 answers, the other routes near the summit do not
const osmAnswers = call => {
  if (call.url.includes('/map.json?bbox=')) return json(fx('osm-glockner-map.json'))
  if (call.url.includes('/relation/14622955/full.json')) return json(fx('osm-712-full.json'))
}

test('a route list looked up eight days ago is served from the store: OpenStreetMap is not asked', async () => {
  reset(); answerWith(stored(8))
  const res = await ask('203.0.113.61')
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { routes: [] })
  assert.deepEqual(osm().map(c => c.url), [])
})

test('a route list looked up 29 days ago is still served from the store, one looked up 31 days ago is looked up again', async () => {
  reset(); answerWith(stored(29))
  await ask('203.0.113.62')
  assert.equal(osm().length, 0)
  reset(); answerWith(call => stored(31)(call) ?? osmAnswers(call))
  await ask('203.0.113.63')
  assert.ok(osm().some(c => c.url.includes('/map.json?bbox=')), 'OpenStreetMap is asked for the routes near the peak')
})

test('a lookup in which a route failed is stored dated to be tried again after one day, not after 30', async () => {
  reset(); answerWith(osmAnswers)
  const before = Date.now()
  const res = await ask('203.0.113.64')
  assert.equal(res.status, 200)
  const write = seen.find(c => c.method === 'POST' && c.url.includes('/rest/v1/route_cache'))
  assert.ok(write, 'the list is stored')
  const row = [JSON.parse(write.body)].flat()[0]
  assert.equal(row.routes.length, 1, 'the one route that answered')
  // it counts as looked up 29 days ago: one more day and it is looked up again
  const age = before - Date.parse(row.fetched_at)
  assert.ok(Math.abs(age - 29 * DAY) < 60_000, `dated ${Math.round(age / DAY * 10) / 10} days back`)
})

// The nightly cleanup deleted lists older than 30 days. With a week of freshness that left 23 days in which an
// old copy could still stand in when OpenStreetMap was down. With 30 days of freshness it would delete a list
// the night it is due, and a list dated for a retry after one day on the night after it was stored. So the
// cleanup keeps a list 30 days past its freshness.
test('the nightly cleanup keeps a route list 60 days: 30 fresh and 30 more as the copy for an OpenStreetMap outage', async () => {
  const { jobRequest } = await import('./test-route-fakes.js')
  const { GET: cleanup } = await import('../app/api/cleanup/route.js')
  reset()
  const start = Date.now()
  const res = await cleanup(jobRequest('/api/cleanup'))
  assert.equal(res.status, 200)
  const cuts = seen.filter(c => c.method === 'DELETE' && c.url.includes('/rest/v1/route_cache?')).map(c => Date.parse(c.url.match(/fetched_at=lt\.([^&]+)/)[1]))
  assert.equal(cuts.length, 1, 'one delete of old route lists')
  const days = (start - cuts[0]) / DAY
  assert.ok(Math.abs(days - 60) < 0.01, `deletes lists older than ${Math.round(days * 10) / 10} days`)
})

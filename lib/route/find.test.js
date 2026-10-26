import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { findRoutes, healRoutes, withoutGuesses } from './find.js'

const fx = name => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8'))
const PEAK = { name: 'Großglockner', lat: 47.0745, lon: 12.6941, elev: 3798 }
const calls = []
const getJson = async url => {
  calls.push(url)
  if (url.includes('/map.json?bbox=')) return fx('osm-glockner-map.json')
  if (url.includes('/relation/14622955/full.json')) return fx('osm-712-full.json')
  return null
}
// higher to the north, like the real 712: Lucknerhaus (south) → summit (north)
const getElevations = async pts => pts.map(p => Math.round(1300 + (p.lat - 47) * 30000))

test('findRoutes — the 712 from the OSM API: uphill, timed there and back, simplified', async () => {
  const routes = await findRoutes(PEAK, { getJson, getElevations })
  assert.ok(calls[0].includes('bbox=12.68510,47.06850,12.70310,47.08050'), calls[0])
  const r = routes.find(x => x.id === 14622955)
  assert.ok(r, JSON.stringify(routes.map(x => x.id)))
  assert.equal(r.ref, '712')
  assert.ok(r.points.length <= 300)
  assert.ok(r.points[0][2] < r.points.at(-1)[2], 'starts low')
  assert.deepEqual(r.points.at(-1), [47.0745, 12.6941, 3798], 'walks on to the summit')
  assert.equal(r.roundTrip, true)
  assert.ok(r.distanceKm > 2 && r.minutes > 60 && r.ascentM > 500)
})

test('findRoutes — the OSM API down: null (the route serves the cache)', async () => {
  assert.equal(await findRoutes(PEAK, { getJson: async () => null, getElevations }), null)
})

test('findRoutes — heights from the terrain model are marked as such (shown as approximate)', async () => {
  const routes = await findRoutes(PEAK, { getJson, getElevations })
  assert.equal(routes.find(x => x.id === 14622955).heights, 'terrain')
})

test('findRoutes — no heights to be had: the way is kept, but no ascent and no walking time (never a flat-land time)', async () => {
  const routes = await findRoutes(PEAK, { getJson, getElevations: async () => null, wait: async () => {} })
  const r = routes.find(x => x.id === 14622955)
  assert.equal(r.heights, null)
  assert.equal(r.minutes, null)
  assert.equal(r.ascentM, null)
  assert.equal(r.descentM, null)
  assert.ok(r.distanceKm > 2)
})

test('healRoutes — cached routes that lost their heights get them now, timed again; complete ones are left alone', async () => {
  const broken = { id: 1, roundTrip: true, distanceKm: 84, ascentM: 0, descentM: 0, minutes: 1260, points: [[-3.1, 37.2, null], [-3.09, 37.25, null], [-3.07, 37.35, 5895]] }
  const fine = { id: 2, roundTrip: true, distanceKm: 1, ascentM: 100, descentM: 100, minutes: 60, heights: 'terrain', points: [[47, 12, 1000], [47.001, 12, 1100]] }
  const asked = []
  const { routes, changed } = await healRoutes([broken, fine], async list => { asked.push(list.length); return list.map((_, i) => 1800 + i * 500) }, { wait: async () => {} })
  assert.equal(changed, true)
  assert.deepEqual(asked, [2]) // only the two missing points of the broken route
  const healed = routes[0]
  assert.equal(healed.heights, 'terrain')
  assert.ok(healed.ascentM > 3000, String(healed.ascentM))
  assert.ok(healed.minutes > 1260, 'longer than the flat-land time it had')
  assert.deepEqual(routes[1], fine)
  // still nothing to be had: no time rather than a wrong one, and nothing to save
  const still = await healRoutes([broken], async () => null, { wait: async () => {} })
  assert.equal(still.routes[0].minutes, null)
  assert.equal(still.routes[0].ascentM, null)
  assert.equal(still.changed, true) // the wrong flat-land numbers are gone from the cache
  // an old cached route with full heights but no marker: just marked
  const old = { ...fine, heights: undefined }
  const marked = await healRoutes([old], async () => { throw new Error('not asked') }, { wait: async () => {} })
  assert.equal(marked.routes[0].heights, 'terrain')
})

test('withoutGuesses — what can be served at once: routes without heights lose their flat-land numbers, no network', () => {
  const broken = { id: 1, roundTrip: true, distanceKm: 84, ascentM: 0, descentM: 0, minutes: 1260, points: [[-3.1, 37.2, null], [-3.09, 37.25, null], [-3.07, 37.35, 5895]] }
  const fine = { id: 2, roundTrip: true, distanceKm: 1, ascentM: 100, descentM: 100, minutes: 60, heights: 'terrain', points: [[47, 12, 1000], [47.001, 12, 1100]] }
  const old = { ...fine, id: 3, heights: undefined }
  const { routes, missing } = withoutGuesses([broken, fine, old])
  assert.equal(missing, 1)
  assert.deepEqual([routes[0].heights, routes[0].ascentM, routes[0].minutes, routes[0].distanceKm], [null, null, null, 84])
  assert.deepEqual(routes[1], fine)
  assert.equal(routes[2].heights, 'terrain') // full heights, from before the marker existed
})

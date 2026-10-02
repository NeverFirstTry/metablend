import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { findRoutes } from './find.js'

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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm } from '../geo.js'
import { nearCell, ringPoints, pickNearPeaks } from './near.js'

const LIENZ = { lat: 46.8289, lon: 12.7695 }

test('nearCell — positions snap to a ~5 km grid (one cached answer per cell); junk is null', () => {
  assert.deepEqual(nearCell(46.8289, 12.7695), { lat: 46.85, lon: 12.75 })
  assert.deepEqual(nearCell(-33.87, 151.21), { lat: -33.85, lon: 151.2 })
  assert.equal(nearCell(91, 0), null)
  assert.equal(nearCell(0, 181), null)
  assert.equal(nearCell(Number.NaN, 0), null)
  assert.equal(nearCell('46.8', '12.7'), null)
})

test('ringPoints — n points at the given distance around a centre', () => {
  const pts = ringPoints(LIENZ, 12, 6)
  assert.equal(pts.length, 6)
  for (const p of pts) assert.ok(Math.abs(haversineKm(LIENZ.lat, LIENZ.lon, p.lat, p.lon) - 12) < 0.2, JSON.stringify(p))
})

// small hills right next to town, the notable summits a bit further out
const peak = (name, lat, lon, elev, extra = {}) => ({ id: `osm-N${name}`, name, lat, lon, elev, kind: 'peak', country: 'AT', ...extra })
const found = [
  peak('Goggkreuz', 46.808, 12.757, 1260), peak('Kreidenfeuer', 46.800, 12.766, 1430), peak('Rauchkofel', 46.799, 12.782, 1910),
  peak('Spitzkofel', 46.770, 12.703, 2717), peak('Hochstadel', 46.765, 12.890, 2681), peak('Schleinitz', 46.890, 12.770, 2905),
  peak('Große Sandspitze', 46.757, 12.840, 2770), peak('Petzeck', 46.969, 12.810, 3283), peak('Hochschober', 46.968, 12.700, 3242),
  peak('Glödis', 46.950, 12.718, 3206), peak('Ederplan', 46.792, 12.915, 2061), peak('Hochstein', 46.824, 12.693, 2023),
  peak('No height', 46.83, 12.78, null), peak('Far away', 47.30, 12.70, 3500),
]
const featured = [
  { id: 'grossglockner', name: 'Großglockner', lat: 47.07455, lon: 12.69388, elev: 3798, kind: 'peak', country: 'AT', grade: 'WS', region: 'eastern-alps' },
  { id: 'drei-zinnen', name: 'Drei Zinnen (Große Zinne)', lat: 46.61944, lon: 12.30254, elev: 2999, kind: 'peak', country: 'IT', grade: 'S', region: 'dolomites' },
]

test('pickNearPeaks — the highest summits within 20 km, nearest first; hills, shoulders and far peaks drop out', () => {
  const near = pickNearPeaks(found, featured, LIENZ)
  const names = near.map(p => p.name)
  assert.ok(near.length >= 7 && near.length <= 10, String(near.length))
  for (const n of ['Petzeck', 'Hochschober', 'Schleinitz', 'Spitzkofel', 'Hochstadel', 'Große Sandspitze']) assert.ok(names.includes(n), n)
  // Glödis is 2 km from the higher Hochschober; Goggkreuz and Kreidenfeuer sit under Rauchkofel
  for (const n of ['Glödis', 'Goggkreuz', 'Kreidenfeuer', 'No height', 'Far away', 'Großglockner', 'Drei Zinnen (Große Zinne)']) assert.ok(!names.includes(n), n)
  const km = near.map(p => p.km)
  assert.deepEqual(km, [...km].sort((a, b) => a - b))
  assert.ok(near.every(p => typeof p.km === 'number'))
})

test('pickNearPeaks — a featured peak in range is always in, as itself (its page, grade and region)', () => {
  const close = [...featured, { id: 'schleinitz-f', name: 'Schleinitz', lat: 46.8902, lon: 12.7701, elev: 2905, kind: 'peak', country: 'AT', grade: 'T3', region: 'eastern-alps' }]
  const near = pickNearPeaks(found.filter(p => p.elev && p.elev < 2000), close, LIENZ)
  const s = near.find(p => p.name === 'Schleinitz')
  assert.equal(s?.id, 'schleinitz-f')
  assert.equal(near.filter(p => p.name === 'Schleinitz').length, 1)
})

test('pickNearPeaks — where 20 km holds fewer than 3 summits, it looks out to 50 km', () => {
  const flat = { lat: 48.2, lon: 16.37 } // Vienna-ish
  const sparse = [peak('Kahlenberg', 48.274, 16.334, 484), peak('Schöpfl', 48.083, 15.917, 893), peak('Hohe Wand', 47.83, 16.04, 1132)]
  const near = pickNearPeaks(sparse, [], flat)
  assert.deepEqual(near.map(p => p.name).sort(), ['Hohe Wand', 'Kahlenberg', 'Schöpfl'])
})

test('pickNearPeaks — nothing found and nothing featured nearby: an empty list (the caller falls back)', () => {
  assert.deepEqual(pickNearPeaks([], featured, { lat: 0, lon: 0 }), [])
})

test('pickNearPeaks — one summit per cluster: a top within 3 km of a higher pick is skipped, so the list spreads out', () => {
  const pos = { lat: 46.85, lon: 12.75 }
  const tops = [
    peak('Großer Hornkopf', 46.970, 12.750, 3251), peak('Kleiner Hornkopf', 46.975, 12.755, 3194), // 0.7 km apart
    peak('Petzeck', 46.969, 12.810, 3283), peak('Klammerköpfe', 46.962, 12.800, 3155), // 1.1 km apart
    peak('Spitzkofel', 46.770, 12.703, 2717), peak('Große Sandspitze', 46.757, 12.840, 2770),
  ]
  const names = pickNearPeaks(tops, [], pos).map(p => p.name)
  assert.ok(!names.includes('Kleiner Hornkopf'))
  assert.ok(!names.includes('Klammerköpfe'))
  for (const n of ['Großer Hornkopf', 'Petzeck', 'Spitzkofel', 'Große Sandspitze']) assert.ok(names.includes(n), n)
  // a featured peak counts as taken: an OSM top right next to it is skipped
  const withFeatured = pickNearPeaks(tops, [{ id: 'petzeck-f', name: 'Petzeck (featured)', lat: 46.9692, lon: 12.8102, elev: 3283, country: 'AT' }], pos)
  assert.ok(!withFeatured.some(p => p.name === 'Klammerköpfe'))
})

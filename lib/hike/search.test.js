import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalize, matchFeatured, parsePhoton, parseGeocodingPeaks, mergePeaks } from './search.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

test('normalize / matchFeatured — umlauts, ß, case and aliases', () => {
  assert.equal(normalize('Großglockner'), 'grossglockner')
  assert.equal(normalize('Ötscher'), 'otscher')
  const F = [
    { name: 'Großglockner', aka: ['Grossglockner'] },
    { name: 'Rax (Heukuppe)', aka: ['Rax', 'Raxalpe'] },
    { name: 'Ötscher', aka: ['Oetscher'] },
  ]
  assert.deepEqual(matchFeatured('glockner', F).map(p => p.name), ['Großglockner'])
  assert.deepEqual(matchFeatured('RAXALPE', F).map(p => p.name), ['Rax (Heukuppe)'])
  assert.deepEqual(matchFeatured('Oetscher', F).map(p => p.name), ['Ötscher'])
  assert.deepEqual(matchFeatured('zzz', F), [])
})

test('parsePhoton — the recorded Schneeberg search: peaks and huts, heights still missing', () => {
  const r = parsePhoton(fx('photon-schneeberg.json'))
  assert.ok(r.length > 0)
  assert.ok(r.every(p => p.id.startsWith('osm-') && typeof p.lat === 'number' && typeof p.lon === 'number' && p.elev === null))
  assert.ok(r.every(p => p.kind === 'peak' || p.kind === 'hut'))
  assert.equal(parsePhoton(null), null)
})

test('parseGeocodingPeaks — mountains with a height only; towns dropped', () => {
  const r = parseGeocodingPeaks(fx('geocoding-zugspitze.json'))
  assert.ok(r.some(p => p.name === 'Zugspitze' && p.elev > 2900))
  assert.deepEqual(parseGeocodingPeaks({ results: [{ id: 1, name: 'Schneeberg', feature_code: 'PPL', elevation: 400, latitude: 1, longitude: 1 }] }), [])
  assert.deepEqual(parseGeocodingPeaks({}), [])
  assert.equal(parseGeocodingPeaks(null), null)
})

test('mergePeaks — featured first, heights filled in, one summit once, no height no result', () => {
  const featured = [{ id: 'schneeberg', name: 'Schneeberg (Klosterwappen)', lat: 47.7675, lon: 15.8069, elev: 2076 }]
  const found = [
    { id: 'osm-N1', name: 'Klosterwappen', lat: 47.768, lon: 15.807, elev: null }, // the featured summit again
    { id: 'osm-N2', name: 'Schneeberg', lat: 50.052, lon: 11.853, elev: null },
    { id: 'osm-N3', name: 'Schneeberg', lat: 50.785, lon: 6.018, elev: null },
  ]
  assert.deepEqual(mergePeaks(featured, found, [2070, 1051, null]).map(p => [p.id, p.elev]), [['schneeberg', 2076], ['osm-N2', 1051]])
  // elevation service down: Photon hits can't be forecast, featured still come back
  assert.deepEqual(mergePeaks(featured, found, null).map(p => p.id), ['schneeberg'])
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `osm-N${i}`, name: 'P', lat: i, lon: i, elev: 1000 }))
  assert.equal(mergePeaks([], many, []).length, 10)
})

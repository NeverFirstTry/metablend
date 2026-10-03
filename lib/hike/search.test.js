import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalize, matchFeatured, parsePhoton, parseGeocodingPeaks, mergePeaks, searchMaxAge, applyLocation, FEATURED_MAX } from './search.js'

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

test('matchFeatured — two letters match the start of a word only', () => {
  const F = [{ name: 'Eiger' }, { name: 'Hoher Dachstein' }, { name: 'Säntis' }]
  assert.deepEqual(matchFeatured('ei', F).map(p => p.name), ['Eiger']) // not "Dachstein"
  assert.deepEqual(matchFeatured('da', F).map(p => p.name), ['Hoher Dachstein'])
})

test('parsePhoton — the recorded Schneeberg search: peaks and huts, heights still missing', () => {
  const r = parsePhoton(fx('photon-schneeberg.json'))
  assert.ok(r.length > 0)
  assert.ok(r.every(p => p.id.startsWith('osm-') && typeof p.lat === 'number' && typeof p.lon === 'number' && p.elev === null))
  assert.ok(r.every(p => p.kind === 'peak' || p.kind === 'hut'))
  assert.equal(parsePhoton(null), null)
  // a hit with broken coordinates is dropped, not a crash later
  assert.deepEqual(parsePhoton({ features: [{ properties: { name: 'X', osm_type: 'N', osm_id: 1 }, geometry: { coordinates: ['a', null] } }] }), [])
})

test('parseGeocodingPeaks — mountains with a height only; towns dropped', () => {
  const r = parseGeocodingPeaks(fx('geocoding-zugspitze.json'))
  assert.ok(r.some(p => p.name === 'Zugspitze' && p.elev > 2900))
  assert.deepEqual(parseGeocodingPeaks({ results: [{ id: 1, name: 'Schneeberg', feature_code: 'PPL', elevation: 400, latitude: 1, longitude: 1 }] }), [])
  assert.deepEqual(parseGeocodingPeaks({}), [])
  assert.equal(parseGeocodingPeaks(null), null)
})

test('searchMaxAge — a day when every source answered, 5 minutes when one was down', () => {
  assert.equal(searchMaxAge({ photonDown: false, elevationsDown: false }), 86400)
  assert.equal(searchMaxAge({ photonDown: true, elevationsDown: false }), 300)
  assert.equal(searchMaxAge({ photonDown: false, elevationsDown: true }), 300)
})

test('mergePeaks — featured first (in the common shape), one summit once, no height no result', () => {
  const featured = [{ id: 'schneeberg', name: 'Schneeberg (Klosterwappen)', aka: ['Schneeberg'], lat: 47.7675, lon: 15.8069, elev: 2076, country: 'AT', kind: 'peak', region: 'eastern-alps', grade: 'T2' }]
  const found = [
    { id: 'osm-N1', name: 'Klosterwappen', lat: 47.768, lon: 15.807, elev: 2076 }, // the featured summit again
    { id: 'osm-N2', name: 'Schneeberg', lat: 50.052, lon: 11.853, elev: 1051 },
    { id: 'osm-N3', name: 'Schneeberg', lat: 50.785, lon: 6.018, elev: null }, // no height anywhere
  ]
  const r = mergePeaks(featured, found)
  assert.deepEqual(r.map(p => [p.id, p.elev]), [['schneeberg', 2076], ['osm-N2', 1051]])
  assert.deepEqual(r[0], { id: 'schneeberg', name: 'Schneeberg (Klosterwappen)', lat: 47.7675, lon: 15.8069, elev: 2076, country: 'AT', region: null, kind: 'peak', grade: 'T2' })
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `osm-N${i}`, name: 'P', lat: i, lon: i, elev: 1000 }))
  assert.equal(mergePeaks([], many).length, 10)
})

test('applyLocation — the search gets a rounded bias, the peak list the exact position (it shows km)', () => {
  const calls = []
  applyLocation({ lat: 46.8349, lon: 12.7712 }, { setBias: p => calls.push(['bias', p]), onLocate: p => calls.push(['pos', p]) })
  assert.deepEqual(calls, [['bias', { lat: 46.8, lon: 12.8 }], ['pos', { lat: 46.8349, lon: 12.7712 }]])
  applyLocation({ lat: 1, lon: 2 }, { setBias: () => {} }) // no onLocate: fine
})

test('matchFeatured — names starting with the query first, at most FEATURED_MAX, room left for OSM hits', () => {
  const F = ['Mount Rainier', 'Mount Whitney', 'Mount Elbert', 'Mount Temple', 'Mount Fuji', 'Mount Kinabalu', 'Hochmount', 'Mount Meru']
    .map(name => ({ name }))
  const r = matchFeatured('mount', F)
  assert.equal(r.length, FEATURED_MAX)
  assert.ok(r.every(p => p.name.startsWith('Mount')), r.map(p => p.name).join())
  assert.deepEqual(matchFeatured('hochmount', F).map(p => p.name), ['Hochmount'])
  const word = matchFeatured('fuji', [{ name: 'Mount Fuji' }, { name: 'Fujisan Hut' }])
  assert.deepEqual(word.map(p => p.name), ['Fujisan Hut', 'Mount Fuji']) // the name start beats a later word
})

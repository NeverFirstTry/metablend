import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePeakQuery, parseSearchQuery, hikeApiPath, peakFromParams, peakHref } from './params.js'

const sp = s => new URLSearchParams(s)

test('parsePeakQuery — valid peak, rounded so equal peaks share a cache entry', () => {
  assert.deepEqual(parsePeakQuery(sp('lat=47.074512&lon=12.694534&elev=3798.4&name=%20Gro%C3%9Fglockner%20')), {
    name: 'Großglockner', lat: 47.075, lon: 12.695, elev: 3798,
  })
  assert.deepEqual(parsePeakQuery(sp('lat=10&lon=20&elev=0')), { name: null, lat: 10, lon: 20, elev: 0 })
})

test('parsePeakQuery — junk, missing or out-of-range values are rejected', () => {
  for (const q of ['lat=47,07&lon=12&elev=3000', 'lat=47&elev=3000', 'lat=47&lon=12&elev=abc', 'lat=47&lon=12&elev=-5', 'lat=95&lon=12&elev=100', 'lat=47&lon=12&elev=', 'lat=47&lon=200&elev=100']) {
    assert.equal(parsePeakQuery(sp(q)), null, q)
  }
})

test('parseSearchQuery — 2–80 characters, optional rounded location bias', () => {
  assert.deepEqual(parseSearchQuery(sp('q=%20Rax%20&lat=48.2082&lon=16.3738')), { q: 'Rax', bias: { lat: 48.2, lon: 16.4 } })
  assert.deepEqual(parseSearchQuery(sp('q=Eiger')), { q: 'Eiger', bias: null })
  assert.equal(parseSearchQuery(sp('q=a')), null)
  assert.equal(parseSearchQuery(sp(`q=${'x'.repeat(81)}`)), null)
  assert.deepEqual(parseSearchQuery(sp('q=Eiger&lat=abc&lon=5')), { q: 'Eiger', bias: null })
})

const FEATURED = [{ id: 'grossglockner', name: 'Großglockner', lat: 47.07455, lon: 12.69388, elev: 3798, country: 'AT', kind: 'peak' }]

test('hikeApiPath — one canonical URL per peak (3 decimals, whole metres)', () => {
  assert.equal(hikeApiPath(FEATURED[0]), '/api/hike?lat=47.075&lon=12.694&elev=3798&name=Gro%C3%9Fglockner')
  assert.equal(hikeApiPath({ name: 'X', lat: -3.06741, lon: 37.35561, elev: 5895.4 }), '/api/hike?lat=-3.067&lon=37.356&elev=5895&name=X')
})

test('peakFromParams — featured id, coordinates, or nothing (never a crash)', () => {
  assert.equal(peakFromParams(sp('peak=grossglockner'), FEATURED).name, 'Großglockner')
  assert.deepEqual(peakFromParams(sp('lat=50.052&lon=11.853&elev=1051&name=Schneeberg&cc=DE&approx=1'), FEATURED), {
    id: 'q-50.052,11.853', name: 'Schneeberg', lat: 50.052, lon: 11.853, elev: 1051, country: 'DE', elevApprox: true,
  })
  for (const q of ['peak=nope', 'lat=abc&lon=1&elev=100', 'lat=1&lon=1', '', 'lat=1&lon=1&elev=-3']) {
    assert.equal(peakFromParams(sp(q), FEATURED), null, q)
  }
})

test('peakHref — featured peaks by id, everything else by coordinates', () => {
  const ids = new Set(['grossglockner'])
  assert.equal(peakHref(FEATURED[0], ids), '/hike?peak=grossglockner')
  assert.equal(peakHref({ id: 'osm-N1', name: 'Schneeberg', lat: 50.052, lon: 11.853, elev: 1051, country: 'DE', elevApprox: true }, ids),
    '/hike?lat=50.052&lon=11.853&elev=1051&name=Schneeberg&cc=DE&approx=1')
})

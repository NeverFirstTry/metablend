import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePeakQuery, parseSearchQuery } from './params.js'

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

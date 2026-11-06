import { test } from 'node:test'
import assert from 'node:assert/strict'
import { askName, haversineKm, nearParam, parseNear, rememberName, withNear } from './geo.js'
import { haversineM } from './route/geometry.js'

test('haversineKm — Vienna to Munich is about 355 km', () => {
  const km = haversineKm(48.21, 16.37, 48.14, 11.58)
  assert.ok(km > 350 && km < 360, String(km))
  assert.equal(haversineKm(10, 10, 10, 10), 0)
})

test('nearParam / parseNear — the place a search came from, to one decimal (about 10 km: enough to tell same-name towns apart, few cache keys)', () => {
  assert.equal(nearParam(38.90122, -77.26526), '38.9,-77.3')
  assert.deepEqual(parseNear('38.9,-77.3'), { lat: 38.9, lon: -77.3 })
  assert.deepEqual(parseNear('38.9123,-77.2'), { lat: 38.9, lon: -77.2 })
  for (const bad of [null, '', 'abc', '91,0', '0,181', '1,2,3', '1,']) assert.equal(parseNear(bad), null, String(bad))
})

test('withNear — where each place was found, by name (any case); a new pick replaces the old one; the oldest go past 20', () => {
  let m = withNear({}, 'Vienna', '38.9,-77.3')
  assert.deepEqual(m, { vienna: '38.9,-77.3' })
  m = withNear(m, 'VIENNA', '48.2,16.4') // picked the Austrian one this time
  assert.deepEqual(m, { vienna: '48.2,16.4' })
  for (let i = 0; i < 25; i++) m = withNear(m, `Town ${i}`, '1,1')
  assert.equal(Object.keys(m).length, 20)
  assert.equal(m.vienna, undefined)
  assert.equal(m['town 24'], '1,1')
})

test('one distance formula: metres on a route agree with kilometres, and opposite points of the earth stay a number', () => {
  const vienna = { lat: 48.21, lon: 16.37 }, munich = { lat: 48.14, lon: 11.58 }
  assert.equal(haversineM(vienna, munich), haversineKm(vienna.lat, vienna.lon, munich.lat, munich.lon) * 1000)
  assert.ok(Math.abs(haversineKm(0, 0, 0, 180) - 20015.1) < 0.1)
  assert.ok(Number.isFinite(haversineKm(37.5, -122.3, -37.5, 57.7)))
})

// a name given in one language means nothing, or another place, in the next
test('askName — a translated name is asked by its English one in any other language', () => {
  const map = rememberName({}, 'リエンツ', 'Lienz', 'ja')
  assert.equal(askName(map, 'リエンツ', 'en'), 'Lienz')
  assert.equal(askName(map, 'リエンツ', 'zh'), 'Lienz')
})

test('askName — in the language that gave the name it stays as it is, so its CDN copy stays shared', () => {
  const map = rememberName({}, 'Wien', 'Vienna', 'de')
  assert.equal(askName(map, 'wien ', 'de'), 'wien ')
})

test('askName — a name never seen, a place the user typed for the first time, stays as it is', () => {
  assert.equal(askName({}, 'Innsbruck', 'en'), 'Innsbruck')
})

test('rememberName — a name that already is the English one needs no entry', () => {
  assert.deepEqual(rememberName({}, 'Lienz', 'Lienz', 'de'), {})
  assert.deepEqual(rememberName({}, 'lienz', 'Lienz', 'de'), {})
})

test('rememberName — an older forecast without an English name changes nothing', () => {
  assert.deepEqual(rememberName({}, 'Wien', undefined, 'de'), {})
})

test('rememberName — a region added to tell same-name towns apart is left to near, which keeps the town', () => {
  const map = rememberName({}, 'ビエナ', 'Vienna, Virginia', 'ja')
  assert.equal(askName(map, 'ビエナ', 'en'), 'Vienna')
})

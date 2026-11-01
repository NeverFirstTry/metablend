import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm, nearParam, parseNear } from './geo.js'

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

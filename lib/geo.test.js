import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm } from './geo.js'

test('haversineKm — Vienna to Munich is about 355 km', () => {
  const km = haversineKm(48.21, 16.37, 48.14, 11.58)
  assert.ok(km > 350 && km < 360, String(km))
  assert.equal(haversineKm(10, 10, 10, 10), 0)
})

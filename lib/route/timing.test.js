import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legMinutes, etas, routeStats, PACE } from './timing.js'

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
const STEP = 300 / 111195.08 // degrees of latitude for 300 m

test('legMinutes — DIN 33466: the larger time plus half the smaller', () => {
  assert.equal(legMinutes(4000, 0, 0), 60)
  assert.equal(legMinutes(3000, 900, 0), 202.5)
  assert.equal(legMinutes(3000, 0, 900), 130.5)
})

test('etas — a steady 900 m climb over 3 km takes 3 h 22.5 min, slow pace 25 % longer', () => {
  const pts = Array.from({ length: 11 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: i * 90 }))
  near(etas(pts).at(-1), 202.5, 0.5)
  near(etas(pts, 'slow').at(-1), 202.5 * PACE.slow, 0.6)
  assert.equal(etas(pts)[0], 0)
})

test('routeStats — distance, climb and time, rounded for display', () => {
  const pts = Array.from({ length: 11 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: i * 90 }))
  assert.deepEqual(routeStats(pts, 'normal'), { distanceKm: 3, ascentM: 900, descentM: 0, minutes: 203 })
})

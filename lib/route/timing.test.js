import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legMinutes, etas, routeStats, PACE, isMultiDay, DAY_MAX_MIN } from './timing.js'

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

test('etas — a wobble under 5 m (what smoothing leaves of the terrain noise) is not walked as up and down; every point still gets its time', () => {
  // 2 m up per 22 m leg, ±3 m wobble from point to point
  const clean = Array.from({ length: 200 }, (_, i) => ({ lat: 47 + i * 0.0002, lon: 12, ele: 1000 + 2 * i }))
  const wobbly = clean.map((p, i) => ({ ...p, ele: p.ele + (i % 2 ? 3 : -3) }))
  near(etas(wobbly).at(-1), etas(clean).at(-1), etas(clean).at(-1) * 0.03)
  const t = etas(wobbly)
  assert.equal(t.length, 200)
  assert.ok(t.every((m, i) => i === 0 || m >= t[i - 1]), 'times only rise')
  // a flat route is horizontal time only: 4 km/h
  near(etas([{ lat: 47, lon: 12, ele: 500 }, { lat: 47 + 4000 / 111195.08, lon: 12, ele: 502 }]).at(-1), 60 + 0.2, 0.5)
})

test('routeStats — distance, climb and time, rounded for display', () => {
  const pts = Array.from({ length: 11 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: i * 90 }))
  assert.deepEqual(routeStats(pts, 'normal'), { distanceKm: 3, ascentM: 900, descentM: 0, minutes: 203 })
})

test('isMultiDay — more than 12 h of walking (DIN time, no breaks) is not one day out', () => {
  assert.equal(DAY_MAX_MIN, 12 * 60)
  assert.equal(isMultiDay(12 * 60), false)
  assert.equal(isMultiDay(12 * 60 + 1), true)
  assert.equal(isMultiDay(47 * 60), true) // Lemosho
  assert.equal(isMultiDay(null), false) // no heights: no time at all, nothing to call multi-day
})

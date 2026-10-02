import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineM, cumulative, climb, highestIndex, simplify, withReturn } from './geometry.js'

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)

test('haversineM / cumulative — one degree of latitude, running sums', () => {
  near(haversineM({ lat: 47, lon: 12 }, { lat: 48, lon: 12 }), 111195, 2)
  const c = cumulative([{ lat: 47, lon: 12 }, { lat: 47.001, lon: 12 }, { lat: 47.002, lon: 12 }])
  assert.equal(c.length, 3)
  near(c[2], 222.4, 0.5)
})

test('climb — GPS noise below 5 m does not count', () => {
  const pts = [100, 102, 99, 101, 110, 108, 120, 119, 100].map((ele, i) => ({ lat: 47 + i / 1e4, lon: 12, ele }))
  assert.deepEqual(climb(pts), { ascentM: 20, descentM: 20 })
  assert.deepEqual(climb([{ lat: 1, lon: 1, ele: null }, { lat: 1, lon: 1, ele: null }]), { ascentM: 0, descentM: 0 })
})

test('simplify — keeps ends, highest point and the shape; never more than asked', () => {
  const pts = Array.from({ length: 1000 }, (_, i) => ({ lat: 47 + i / 1e5, lon: 12 + (i === 600 ? 0.01 : 0), ele: i === 300 ? 3000 : 1000 }))
  const s = simplify(pts, 50)
  assert.ok(s.length <= 50)
  assert.equal(s[0], pts[0])
  assert.equal(s[s.length - 1], pts[999])
  assert.ok(s.includes(pts[300]), 'highest point kept')
  assert.ok(s.includes(pts[600]), 'the spike kept')
  assert.deepEqual(simplify(pts.slice(0, 10), 50), pts.slice(0, 10))
  assert.equal(highestIndex(pts), 300)
})

test('withReturn — there and back without doubling the turning point', () => {
  const a = { lat: 1, lon: 1, ele: 1 }, b = { lat: 2, lon: 2, ele: 2 }, c = { lat: 3, lon: 3, ele: 3 }
  assert.deepEqual(withReturn([a, b, c]), [a, b, c, b, a])
})

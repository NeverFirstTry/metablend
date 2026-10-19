import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCapPolygon, inAnyRing, bboxOf } from './geometry.js'

test('parseCapPolygon — CAP "lat,lon lat,lon …" → a ring of [lon, lat]; junk → null', () => {
  assert.deepEqual(parseCapPolygon('46.0,12.0 46.0,13.0 47.0,13.0 46.0,12.0'), [[12, 46], [13, 46], [13, 47], [12, 46]])
  assert.equal(parseCapPolygon(''), null)
  assert.equal(parseCapPolygon('46,12 47,13'), null) // not a ring
  assert.equal(parseCapPolygon('46,x 47,13 48,14'), null)
})

test('parseCapPolygon — long outlines are simplified (~500 m) and rounded to 4 decimals', () => {
  const pts = Array.from({ length: 200 }, (_, i) => [46 + i * 0.001, 12 + Math.sin(i / 10) * 0.0004])
  const ring = parseCapPolygon([...pts, [47, 13], pts[0]].map(([la, lo]) => `${la},${lo}`).join(' '))
  assert.ok(ring.length < 20, String(ring.length))
  assert.ok(ring.every(([x, y]) => Number.isInteger(x * 1e4 + 1e-9 | 0) && Math.abs(y * 1e4 - Math.round(y * 1e4)) < 1e-6))
})

test('inAnyRing / bboxOf — inside one of the outlines, and the box around them all', () => {
  const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
  const rings = [sq(12, 46, 13, 47), sq(20, 50, 21, 51)]
  assert.equal(inAnyRing(rings, 12.5, 46.5), true)
  assert.equal(inAnyRing(rings, 20.5, 50.5), true)
  assert.equal(inAnyRing(rings, 16, 48), false)
  assert.deepEqual(bboxOf(rings), [12, 46, 21, 51])
  assert.equal(bboxOf([]), null)
})

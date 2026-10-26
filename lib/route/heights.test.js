import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coverage, hasHeights, fillHeights, HEIGHTS_MIN } from './heights.js'

const pts = (n, ele = null) => Array.from({ length: n }, (_, i) => ({ lat: 47 + i / 1000, lon: 12, ele }))

test('coverage / hasHeights — a walking time needs heights on (nearly) every point', () => {
  assert.equal(coverage([]), 0)
  assert.equal(coverage(pts(4, 1000)), 1)
  const some = pts(10).map((p, i) => ({ ...p, ele: i < 9 ? 1000 + i : null }))
  assert.equal(coverage(some), 0.9)
  assert.equal(HEIGHTS_MIN, 0.9)
  assert.equal(hasHeights(some), true)
  assert.equal(hasHeights(pts(10).map((p, i) => ({ ...p, ele: i < 8 ? 1000 : null }))), false)
  assert.equal(hasHeights(pts(3)), false)
})

test('fillHeights — the missing points from the terrain model, 100 per request; a request that fails is tried once more', async () => {
  const asked = []
  let fails = 1
  const getElevations = async list => { asked.push(list.length); if (fails-- > 0) return null; return list.map(() => 1500) }
  const r = await fillHeights(pts(150), getElevations, { wait: async () => {} })
  assert.deepEqual(asked, [100, 100, 50]) // the first chunk failed, was retried, then the rest
  assert.equal(r.filled, 150)
  assert.ok(r.points.every(p => p.ele === 1500))
})

test('fillHeights — a request failing twice leaves its points empty (never zero); points with heights are not asked again', async () => {
  const asked = []
  const input = pts(120).map((p, i) => ({ ...p, ele: i < 10 ? 900 : null }))
  const r = await fillHeights(input, async list => { asked.push(list.length); return list.length === 100 ? null : list.map(() => 2000) }, { wait: async () => {} })
  assert.deepEqual(asked, [100, 100, 10])
  assert.equal(r.filled, 10)
  assert.equal(r.points.filter(p => p.ele == null).length, 100)
  assert.ok(r.points.slice(0, 10).every(p => p.ele === 900))
})

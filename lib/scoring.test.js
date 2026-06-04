import { test } from 'node:test'
import assert from 'node:assert/strict'
import { median, deltaFromDiff, rawFactor } from './scoring.js'

test('median', () => {
  assert.equal(median([]), 0)
  assert.equal(median([5]), 5)
  assert.equal(median([3, 1, 2]), 2)          // odd, unsorted
  assert.equal(median([1, 2, 3, 4]), 2.5)      // even → average of middle two
  assert.equal(median([-2, 0, 2]), 0)
})

test('deltaFromDiff — instant scheme (1/2/4/6)', () => {
  assert.equal(deltaFromDiff(0), 2)
  assert.equal(deltaFromDiff(1), 2)            // boundary inclusive
  assert.equal(deltaFromDiff(1.5), 1)
  assert.equal(deltaFromDiff(2), 1)
  assert.equal(deltaFromDiff(3), 0)
  assert.equal(deltaFromDiff(4), 0)
  assert.equal(deltaFromDiff(5), -1)
  assert.equal(deltaFromDiff(6), -1)
  assert.equal(deltaFromDiff(6.1), -2)
  assert.equal(deltaFromDiff(20), -2)
})

test('deltaFromDiff — daily scheme is looser (2/4/6/8)', () => {
  assert.equal(deltaFromDiff(2, 'daily'), 2)
  assert.equal(deltaFromDiff(3, 'daily'), 1)
  assert.equal(deltaFromDiff(5, 'daily'), 0)
  assert.equal(deltaFromDiff(7, 'daily'), -1)
  assert.equal(deltaFromDiff(9, 'daily'), -2)
  // unknown scheme falls back to instant
  assert.equal(deltaFromDiff(1, 'nonsense'), 2)
})

// rawFactor uses exponential scaling: max(0.01, exp(avgScore * 0.5)).
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`)

test('rawFactor — mean fallback when no history', () => {
  close(rawFactor(0, 0, null), 1)                 // no data → exp(0) = 1
  close(rawFactor(0, 0, []), 1)                   // empty history → mean path → 1
  close(rawFactor(10, 5, null), Math.exp(1))      // avg +2 → exp(1) (best)
  close(rawFactor(-10, 5, null), Math.exp(-1))    // avg -2 → exp(-1)
})

test('rawFactor — median of history when present', () => {
  close(rawFactor(0, 0, [2, 2, 2]), Math.exp(1))   // median 2
  close(rawFactor(0, 0, [-2, -2, 2]), Math.exp(-1)) // median -2, robust to outlier
})

test('rawFactor — floored at 0.01 so nothing hits zero', () => {
  assert.equal(rawFactor(-100, 1, null), 0.01)       // exp(-50) → clamped to floor
  assert.ok(rawFactor(-1000, 1, null) >= 0.01)
  assert.ok(rawFactor(5, 1, null) > rawFactor(-5, 1, null)) // strictly monotonic
})

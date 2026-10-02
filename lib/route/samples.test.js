import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickSamples } from './samples.js'

const STEP = 100 / 111195.08 // 100 m north per point

test('pickSamples — a long climb: 6–10 points, start, end and the top included', () => {
  const pts = Array.from({ length: 121 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: 1000 + Math.min(i, 80) * 20 - Math.max(0, i - 80) * 10 }))
  const s = pickSamples(pts)
  assert.ok(s.length >= 6 && s.length <= 10, `got ${s.length}`)
  assert.equal(s[0], 0)
  assert.equal(s.at(-1), 120)
  assert.ok(s.includes(80), 'the highest point')
  assert.deepEqual(s, [...s].sort((a, b) => a - b))
})

test('pickSamples — short routes get what they have, never duplicates', () => {
  assert.deepEqual(pickSamples([{ lat: 47, lon: 12, ele: 1 }, { lat: 47.001, lon: 12, ele: 2 }]), [0, 1])
  const five = Array.from({ length: 5 }, (_, i) => ({ lat: 47 + i * STEP, lon: 12, ele: i }))
  assert.deepEqual(pickSamples(five), [0, 1, 2, 3, 4])
})

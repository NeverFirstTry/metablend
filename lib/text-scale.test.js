import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampScale, applyTextScale } from './text-scale.js'

test('clampScale — 1 to 2, steps of 0.05, junk is 1', () => {
  assert.deepEqual([0.8, 1, 1.12, 1.18, 2.4, NaN, null, '1.3'].map(clampScale), [1, 1, 1.1, 1.2, 2, 1, 1, 1.3])
})

test('applyTextScale — sets the root size above 1, clears it at 1', () => {
  const root = { style: { fontSize: '' }, dataset: {} }
  applyTextScale(1.5, root)
  assert.equal(root.style.fontSize, '24px')
  applyTextScale(1, root)
  assert.equal(root.style.fontSize, '')
})

test('applyTextScale — flags large text from 1.3 so cut-off lines can wrap', () => {
  const root = { style: { fontSize: '' }, dataset: {} }
  applyTextScale(1.2, root)
  assert.equal(root.dataset.textLarge, undefined)
  applyTextScale(1.3, root)
  assert.equal(root.dataset.textLarge, '1')
  applyTextScale(1, root)
  assert.equal(root.dataset.textLarge, undefined)
})

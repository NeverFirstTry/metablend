import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dragStep } from './drag-scroll.js'

test('dragStep — a few pixels are a click; past that the strip follows the mouse', () => {
  const start = { startLeft: 100, startX: 500 }
  assert.deepEqual(dragStep({ ...start, x: 503, moved: false }), { moved: false, left: 100 })
  assert.deepEqual(dragStep({ ...start, x: 450, moved: false }), { moved: true, left: 150 }) // dragged left → content moves left
  assert.deepEqual(dragStep({ ...start, x: 498, moved: true }), { moved: true, left: 102 }) // once dragging, every pixel counts
  assert.deepEqual(dragStep({ ...start, x: 700, moved: true }), { moved: true, left: 0 }) // never past the start
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dragStep, barGeometry, seekLeft } from './drag-scroll.js'

test('dragStep — a few pixels are a click; past that the strip follows the mouse', () => {
  const start = { startLeft: 100, startX: 500 }
  assert.deepEqual(dragStep({ ...start, x: 503, moved: false }), { moved: false, left: 100 })
  assert.deepEqual(dragStep({ ...start, x: 450, moved: false }), { moved: true, left: 150 }) // dragged left → content moves left
  assert.deepEqual(dragStep({ ...start, x: 498, moved: true }), { moved: true, left: 102 }) // once dragging, every pixel counts
  assert.deepEqual(dragStep({ ...start, x: 700, moved: true }), { moved: true, left: 0 }) // never past the start
})

test('barGeometry — thumb width and position from the scroll state; nothing when it all fits', () => {
  assert.deepEqual(barGeometry({ scrollLeft: 0, scrollWidth: 1000, clientWidth: 250 }), { w: 0.25, x: 0 })
  assert.deepEqual(barGeometry({ scrollLeft: 750, scrollWidth: 1000, clientWidth: 250 }), { w: 0.25, x: 1 })
  assert.deepEqual(barGeometry({ scrollLeft: 375, scrollWidth: 1000, clientWidth: 250 }), { w: 0.25, x: 0.5 })
  assert.equal(barGeometry({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }), null)
})

test('seekLeft — a point on the bar maps to a scroll position, clamped', () => {
  assert.equal(seekLeft(0.5, 1000, 250), 375)
  assert.equal(seekLeft(-0.2, 1000, 250), 0)
  assert.equal(seekLeft(1.4, 1000, 250), 750)
})

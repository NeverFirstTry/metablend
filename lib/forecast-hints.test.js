import { test } from 'node:test'
import assert from 'node:assert/strict'
import { showRainNow, tickEvery, rainBarWidth } from './forecast-hints.js'

test('showRainNow: only when most sources report rain', () => {
  assert.equal(showRainNow({ count: 6, total: 19 }), false) // "dry today" stays uncontradicted
  assert.equal(showRainNow({ count: 10, total: 19 }), true)
  assert.equal(showRainNow({ count: 0, total: 19 }), false)
  assert.equal(showRainNow(null), false)
})

test('the chart in the evening: a label every hour and narrow bars when few hours are left', () => {
  assert.equal(tickEvery(6), 1) // 18–23: 18, 19, 20 … instead of only 18 and 21
  assert.equal(tickEvery(24), 3)
  assert.equal(tickEvery(48), 6)
  assert.equal(rainBarWidth(330, 6), 12) // not a 53 px block
  assert.equal(rainBarWidth(330, 48), Math.max(2, 330 / 48 - 1.5))
})

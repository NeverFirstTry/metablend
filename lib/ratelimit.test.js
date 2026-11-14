import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter, forgetExpired, sweepAll } from './ratelimit.js'

test('createRateLimiter — allows max hits per window per key, then limits', () => {
  const rl = createRateLimiter({ max: 2, windowMs: 1000 })
  assert.equal(rl.limited('a', 0), false)
  assert.equal(rl.limited('a', 10), false)
  assert.equal(rl.limited('a', 20), true)
  assert.equal(rl.limited('b', 20), false)
  assert.equal(rl.limited('a', 1001), false) // window over → fresh count
})

// the privacy notice: an address is counted for at most its window and not stored
test('a key is forgotten once its window is over, by the one sweep every list shares, not only when a list grows large', () => {
  const minute = createRateLimiter({ max: 2, windowMs: 60_000 }), other = new Map([['x', 5000]])
  forgetExpired(now => { for (const [k, until] of other) if (now >= until) other.delete(k) })
  minute.limited('203.0.113.7', 0)
  minute.limited('203.0.113.8', 30_000)
  assert.equal(minute.size, 2)
  sweepAll(60_001)
  assert.equal(minute.size, 1, 'the first address is gone a minute after its first request')
  assert.equal(other.size, 0, 'and so is what another list had kept until then')
  assert.equal(minute.limited('203.0.113.8', 60_002), false, 'a count that is still running is untouched')
  sweepAll(200_000)
  assert.equal(minute.size, 0)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from './ratelimit.js'

test('createRateLimiter — allows max hits per window per key, then limits', () => {
  const rl = createRateLimiter({ max: 2, windowMs: 1000 })
  assert.equal(rl.limited('a', 0), false)
  assert.equal(rl.limited('a', 10), false)
  assert.equal(rl.limited('a', 20), true)
  assert.equal(rl.limited('b', 20), false)
  assert.equal(rl.limited('a', 1001), false) // window over → fresh count
})

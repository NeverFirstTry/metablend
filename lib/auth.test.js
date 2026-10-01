import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isInternal } from './auth.js'

const req = headers => new Request('https://metablend.app/api/forecast', { headers })

test('isInternal — only with the calibrate secret configured and matching', () => {
  const before = process.env.CALIBRATE_SECRET
  try {
    delete process.env.CALIBRATE_SECRET
    assert.equal(isInternal(req({ 'x-calibrate-key': '' })), false)
    process.env.CALIBRATE_SECRET = 's3cret'
    assert.equal(isInternal(req({ 'x-calibrate-key': 's3cret' })), true)
    assert.equal(isInternal(req({ 'x-calibrate-key': 'nope' })), false)
    assert.equal(isInternal(req({})), false)
  } finally {
    if (before === undefined) delete process.env.CALIBRATE_SECRET
    else process.env.CALIBRATE_SECRET = before
  }
})

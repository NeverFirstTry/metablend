import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCookie } from './prefs.js'

test('readCookie — exact name, decoded, null when missing', () => {
  assert.equal(readCookie('a=1; metablend_lang=de; b=2', 'metablend_lang'), 'de')
  assert.equal(readCookie('xmetablend_lang=fr', 'metablend_lang'), null)
  assert.equal(readCookie('metablend_recent=%5B%22Wien%22%5D', 'metablend_recent'), '["Wien"]')
  assert.equal(readCookie('', 'x'), null)
})

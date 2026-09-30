import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNative } from './native.js'

test('isNative — only inside the Capacitor shell', () => {
  assert.equal(isNative({ Capacitor: { isNativePlatform: () => true } }), true)
  assert.equal(isNative({ Capacitor: { isNativePlatform: () => false } }), false)
  assert.equal(isNative({}), false)
  assert.equal(isNative(undefined), false)
})

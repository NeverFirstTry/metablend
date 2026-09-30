import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNative, isShareCancel } from './native.js'

test('isNative — only inside the Capacitor shell', () => {
  assert.equal(isNative({ Capacitor: { isNativePlatform: () => true } }), true)
  assert.equal(isNative({ Capacitor: { isNativePlatform: () => false } }), false)
  assert.equal(isNative({}), false)
  assert.equal(isNative(undefined), false)
})

test('isShareCancel — only a real cancel counts as handled', () => {
  assert.equal(isShareCancel(new Error('Share canceled')), true)
  assert.equal(isShareCancel({ message: 'User cancelled' }), true)
  assert.equal(isShareCancel(new Error('Failed to fetch dynamically imported module')), false)
  assert.equal(isShareCancel(undefined), false)
})

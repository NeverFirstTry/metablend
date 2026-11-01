import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNative, isShareCancel, positionSource, haptic } from './native.js'

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

test('positionSource — only an already-given permission; inside the app the native one, never the browser API', () => {
  assert.equal(positionSource({ native: true, nativePerm: { location: 'granted' } }), 'native')
  assert.equal(positionSource({ native: true, nativePerm: { location: 'prompt', coarseLocation: 'granted' } }), 'native')
  assert.equal(positionSource({ native: true, nativePerm: { location: 'prompt' }, webPerm: 'granted' }), null)
  assert.equal(positionSource({ native: true, nativePerm: null }), null)
  assert.equal(positionSource({ native: false, webPerm: 'granted' }), 'web')
  assert.equal(positionSource({ native: false, webPerm: 'prompt' }), null)
  assert.equal(positionSource({ native: false }), null)
})

test('haptic — a selection tick, a success tap, a light tap; nothing outside the app', async () => {
  const played = []
  const plugin = {
    ImpactStyle: { Light: 'LIGHT' }, NotificationType: { Success: 'SUCCESS' },
    Haptics: new Proxy({}, { get: (_, name) => async arg => { played.push(arg ? `${name} ${Object.values(arg)[0]}` : name) } }),
  }
  const opts = { win: { Capacitor: { isNativePlatform: () => true } }, load: async () => plugin }
  await haptic('selection', opts)
  await haptic('success', opts)
  await haptic('tap', opts)
  // a selection tick needs its generator started first (iOS), and ended after
  assert.deepEqual(played, ['selectionStart', 'selectionChanged', 'selectionEnd', 'notification SUCCESS', 'impact LIGHT'])
  await haptic('tap', { win: {}, load: async () => plugin })
  assert.equal(played.length, 5)
})

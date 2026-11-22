// The app icon picker with the app builds in people's hands (owner, 2026-11-22). The pages come from the website, so
// a website change reaches every app build at once. TestFlight build 3 (version 1.0, from before 2026-11-10) answers
// AppIcon.get with { name, platform } and no list of icons; since the eleven icons of 2026-11-10 the picker showed
// nothing there. This drives the real currentIcon() through Capacitor's core with a bridge that answers like each
// build's native plugin, and fails if the picker would disappear. Rule: a website change never removes a working
// feature from an older app build.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

let answer = null // what the phone's AppIcon plugin resolves get() with
globalThis.window = globalThis
globalThis.Capacitor = {
  PluginHeaders: [{ name: 'AppIcon', methods: [{ name: 'get', rtype: 'promise' }, { name: 'set', rtype: 'promise' }] }],
  nativePromise: (plugin, method) => Promise.resolve(plugin === 'AppIcon' && method === 'get' ? answer : {}),
  nativeCallback: () => Promise.resolve('stand-in'),
  isNativePlatform: () => true, getPlatform: () => answer?.platform ?? 'ios', platform: 'ios',
}
globalThis.webkit = { messageHandlers: { bridge: { postMessage() {} } } }

const { currentIcon } = await import('./app-icon.js')
const { pickerState } = await import('./app-icon-choices.js')
const ELEVEN = ['slate', 'glow', 'gold', 'light', 'butter', 'summit', 'weather', 'dots', 'mono', 'winter', 'sky']

test('TestFlight build 3 on iPhone (no icon list): the picker shows its four icons, Automatic chosen', async () => {
  answer = { name: 'auto', platform: 'ios' } // AppDelegate.swift's get() before 2026-11-10
  const state = pickerState(await currentIcon())
  assert.ok(state, 'the picker shows')
  assert.deepEqual(state.choices, ['auto', 'light', 'dark', 'sky'])
  assert.equal(state.name, 'auto')
  assert.equal(state.legacy, true)
})

test('an Android build from before 2026-11-10 (no icon list): Sky, Light and Dark', async () => {
  answer = { name: 'dark', platform: 'android' } // AppIconPlugin.java's get() before 2026-11-10
  const state = pickerState(await currentIcon())
  assert.ok(state, 'the picker shows')
  assert.deepEqual(state.choices, ['sky', 'light', 'dark'])
  assert.equal(state.name, 'dark')
})

test('a build with the eleven icons lists them and gets all eleven', async () => {
  answer = { name: 'mono', platform: 'ios', icons: ELEVEN }
  const state = pickerState(await currentIcon())
  assert.deepEqual(state.choices, ELEVEN)
  assert.equal(state.name, 'mono')
  assert.equal(state.legacy, false)
})

test('no plugin answer, or not the app: no picker', async () => {
  answer = {}
  assert.equal(pickerState(await currentIcon()), null)
  assert.equal(pickerState(null), null)
})

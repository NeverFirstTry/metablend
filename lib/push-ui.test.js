import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opensByReload, shouldPrompt } from './push-ui.js'

test('opensByReload — forecast links reload (Home reads ?city= only on load), other screens route', () => {
  assert.equal(opensByReload('/?city=Wien'), true)
  assert.equal(opensByReload('/'), true)
  assert.equal(opensByReload('/hike?lat=1&lon=2&elev=3&name=X'), false)
  assert.equal(opensByReload('/more'), false)
})

test('shouldPrompt — from the 3rd forecast, until dismissed or turned on, never when blocked or cityless', () => {
  const base = { views: 3, dismissed: false, perm: 'prompt', optedIn: false, topCity: 'Wien' }
  assert.equal(shouldPrompt(base), true)
  assert.equal(shouldPrompt({ ...base, views: 2 }), false)
  assert.equal(shouldPrompt({ ...base, dismissed: true }), false)
  assert.equal(shouldPrompt({ ...base, perm: 'denied' }), false)
  assert.equal(shouldPrompt({ ...base, optedIn: true }), false)
  assert.equal(shouldPrompt({ ...base, topCity: null }), false)
  // Android ≤ 12 reports "granted" without ever asking: still an invitation until opted in
  assert.equal(shouldPrompt({ ...base, perm: 'granted' }), true)
})

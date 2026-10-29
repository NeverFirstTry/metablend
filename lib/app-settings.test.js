import { test } from 'node:test'
import assert from 'node:assert/strict'
import { settingsRoute } from './app-settings.js'

const cap = (platform, plugins = []) => ({ getPlatform: () => platform, isPluginAvailable: n => plugins.includes(n) })

test('settingsRoute — iOS by its Settings URL; Android only with the native AppSettings plugin (app builds from 2026-10-29)', () => {
  assert.equal(settingsRoute(cap('ios')), 'ios')
  assert.equal(settingsRoute(cap('android', ['AppSettings'])), 'android')
  assert.equal(settingsRoute(cap('android')), null) // an older build: a link can't open settings there — no button
  assert.equal(settingsRoute(cap('web')), null)
  assert.equal(settingsRoute(undefined), null)
})

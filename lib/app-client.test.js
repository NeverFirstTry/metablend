import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAppRequest } from './app-client.js'

test('isAppRequest — the app user agent, the test cookie, or ?app=1 / ?app=0', () => {
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 (iPhone) MetaBlendApp' }), true)
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 Safari', cookie: 'a=1; metablend_app=1' }), true)
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 Safari', cookie: 'metablend_app=10' }), false)
  assert.equal(isAppRequest({ appParam: '1' }), true)
  assert.equal(isAppRequest({ userAgent: 'MetaBlendApp', appParam: '0' }), false)
  assert.equal(isAppRequest({}), false)
})

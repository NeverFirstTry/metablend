import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAppRequest, APP_BOOT_SCRIPT, startCity } from './app-client.js'

test('isAppRequest — the app user agent, the test cookie, or ?app=1 / ?app=0', () => {
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 (iPhone) MetaBlendApp' }), true)
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 Safari', cookie: 'a=1; metablend_app=1' }), true)
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 Safari', cookie: 'metablend_app=10' }), false)
  assert.equal(isAppRequest({ appParam: '1' }), true)
  assert.equal(isAppRequest({ userAgent: 'MetaBlendApp', appParam: '0' }), false)
  assert.equal(isAppRequest({}), false)
})

// Runs the inline boot script against a fake page and reports what it did.
function boot({ ua = 'Mozilla/5.0', cookie = '', search = '', framed = false } = {}) {
  const meta = { content: 'width=device-width, initial-scale=1' }
  const html = { dataset: {} }
  const doc = { cookie, documentElement: html, querySelector: () => meta }
  const win = {}
  win.top = framed ? {} : win
  win.self = win
  new Function('window', 'document', 'navigator', 'location', APP_BOOT_SCRIPT)(win, doc, { userAgent: ua }, { search })
  return { app: html.dataset.app === '1', viewport: meta.content, cookie: doc.cookie }
}

test('APP_BOOT_SCRIPT — marks the app before first paint, never framed pages or plain visitors', () => {
  const inApp = boot({ ua: 'Mozilla/5.0 (Linux; Android 15) MetaBlendApp' })
  assert.equal(inApp.app, true)
  assert.equal(inApp.viewport, 'width=device-width, initial-scale=1') // cover ships in the HTML now
  // Android drops the custom user agent on service-worker requests; the cookie survives them
  assert.match(inApp.cookie, /^metablend_app=1;/)
  assert.equal(boot({ cookie: 'metablend_app=1' }).app, true)
  assert.equal(boot({ cookie: 'a=1; metablend_lang=de; metablend_app=1' }).app, true) // not the first cookie
  assert.equal(boot({ cookie: 'metablend_app=10' }).app, false)
  const web = boot()
  assert.equal(web.app, false)
  assert.equal(boot({ ua: 'MetaBlendApp', framed: true }).app, false) // the embed preview iframe
  assert.equal(boot({ search: '?app=1' }).app, true)
  const off = boot({ cookie: 'metablend_app=1', search: '?x=1&app=0' })
  assert.equal(off.app, false)
  assert.match(off.cookie, /metablend_app=;/)
})

test('startCity — a deep link wins; inside the app the last city comes back', () => {
  assert.equal(startCity({ deepLink: 'Graz', inApp: true, recent: ['Wien'] }), 'Graz')
  assert.equal(startCity({ deepLink: null, inApp: true, recent: ['Wien', 'Linz'] }), 'Wien')
  assert.equal(startCity({ deepLink: null, inApp: false, recent: ['Wien'] }), null)
  assert.equal(startCity({ deepLink: null, inApp: true, recent: [] }), null)
})

test('startCity — inside the app the city last viewed this session beats Recent (a notification tap is viewed, not searched)', () => {
  assert.equal(startCity({ deepLink: null, inApp: true, last: 'Lienz', recent: ['Wien'] }), 'Lienz')
  assert.equal(startCity({ deepLink: 'Graz', inApp: true, last: 'Lienz', recent: ['Wien'] }), 'Graz')
  assert.equal(startCity({ deepLink: null, inApp: false, last: 'Lienz', recent: ['Wien'] }), null)
})

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
function boot({ ua = 'Mozilla/5.0', cookie = '', search = '', framed = false, stored = null } = {}) {
  const meta = { content: 'width=device-width, initial-scale=1' }
  const html = { dataset: {}, style: { fontSize: '' } }
  const localStorage = { getItem: () => { if (stored === 'throw') throw new Error('blocked'); return stored } }
  const doc = { cookie, documentElement: html, querySelector: () => meta }
  const win = {}
  win.top = framed ? {} : win
  win.self = win
  new Function('window', 'document', 'navigator', 'location', 'localStorage', APP_BOOT_SCRIPT)(win, doc, { userAgent: ua }, { search }, localStorage)
  return { app: html.dataset.app === '1', viewport: meta.content, cookie: doc.cookie, fontSize: html.style.fontSize, textLarge: html.dataset.textLarge }
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

test('APP_BOOT_SCRIPT — Larger Text: the remembered text size before first paint, in the app only', () => {
  const big = boot({ ua: 'MetaBlendApp', stored: '1.5' })
  assert.equal(big.fontSize, '24px')
  assert.equal(big.textLarge, '1')
  const mid = boot({ ua: 'MetaBlendApp', stored: '1.15' })
  assert.equal(mid.fontSize, '18.4px')
  assert.equal(mid.textLarge, undefined)
  for (const stored of [null, 'junk', '1', '0.8', '3']) assert.equal(boot({ ua: 'MetaBlendApp', stored }).fontSize, '', stored)
  assert.equal(boot({ stored: '1.5' }).fontSize, '') // the website keeps the browser's own setting
  const blocked = boot({ ua: 'MetaBlendApp', stored: 'throw' }) // storage off: still the app, normal size
  assert.equal(blocked.app, true)
  assert.equal(blocked.fontSize, '')
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

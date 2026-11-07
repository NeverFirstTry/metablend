import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAppRequest, APP_BOOT_SCRIPT, startCity, deepLinkCity } from './app-client.js'

test('isAppRequest — the app user agent, the test cookie, or ?app=1 / ?app=0', () => {
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 (iPhone) MetaBlendApp' }), true)
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 Safari', cookie: 'a=1; metablend_app=1' }), true)
  assert.equal(isAppRequest({ userAgent: 'Mozilla/5.0 Safari', cookie: 'metablend_app=10' }), false)
  assert.equal(isAppRequest({ appParam: '1' }), true)
  assert.equal(isAppRequest({ userAgent: 'MetaBlendApp', appParam: '0' }), false)
  assert.equal(isAppRequest({}), false)
})

// Runs the inline boot script against a fake page and reports what it did.
function boot({ ua = 'Mozilla/5.0', cookie = '', search = '', framed = false, stored = null, last = null } = {}) {
  const meta = { content: 'width=device-width, initial-scale=1' }
  const html = { dataset: {}, style: { fontSize: '' } }
  const localStorage = { getItem: () => { if (stored === 'throw') throw new Error('blocked'); return stored } }
  const sessionStorage = { getItem: k => (k === 'metablend_last' ? last : null) }
  const doc = { cookie, documentElement: html, querySelector: () => meta }
  const win = {}
  win.top = framed ? {} : win
  win.self = win
  new Function('window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', APP_BOOT_SCRIPT)(win, doc, { userAgent: ua }, { search }, localStorage, sessionStorage)
  return { app: html.dataset.app === '1', viewport: meta.content, cookie: doc.cookie, fontSize: html.style.fontSize, textLarge: html.dataset.textLarge, firstUse: html.dataset.firstUse === '1', returning: html.dataset.returning === '1' }
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

test('startCity — a deep link wins, then the last city; nobody gets a city they never asked for', () => {
  assert.equal(startCity({ deepLink: 'Graz', recent: ['Wien'] }), 'Graz')
  assert.equal(startCity({ deepLink: null, recent: ['Wien', 'Linz'] }), 'Wien')
  assert.equal(startCity({ deepLink: null, recent: [] }), null)
})

test('startCity — the city last viewed this session beats Recent (a notification tap is viewed, not searched)', () => {
  assert.equal(startCity({ deepLink: null, last: 'Lienz', recent: ['Wien'] }), 'Lienz')
  assert.equal(startCity({ deepLink: 'Graz', last: 'Lienz', recent: ['Wien'] }), 'Graz')
})

test('APP_BOOT_SCRIPT — first use (no city yet) marked before first paint, so "Use my location" shows from the first frame', () => {
  const app = 'Mozilla/5.0 (Linux; Android 15) MetaBlendApp'
  assert.equal(boot({ ua: app }).firstUse, true)
  // (the fake document.cookie is replaced on write, so these find the app by its cookie, as later loads do)
  assert.equal(boot({ cookie: 'metablend_app=1; metablend_recent=%5B%5D' }).firstUse, true) // an emptied list
  assert.equal(boot({ cookie: 'metablend_app=1; metablend_recent=%5B%22Vienna%22%5D' }).firstUse, false)
  assert.equal(boot({ ua: app, last: 'Lienz' }).firstUse, false) // looked at a city this session
  assert.equal(boot({ ua: app, search: '?city=Hanoi' }).firstUse, false) // a link brings its city
  assert.equal(boot({ cookie: 'metablend_app=1; metablend_recent=%5Bbroken' }).firstUse, false) // unreadable: not a first use
  assert.equal(boot().firstUse, false) // the website never shows the card
})

test('APP_BOOT_SCRIPT — the website picks forecast or landing page before first paint, exactly as startCity decides', () => {
  // [what the visitor has, what the boot script must say, what startCity must say]
  const cases = [
    [{}, false, null],
    [{ cookie: 'metablend_recent=%5B%22Vienna%22%5D' }, true, 'Vienna'],
    [{ last: 'Lienz' }, true, 'Lienz'],
    [{ search: '?city=Hanoi' }, true, 'Hanoi'],
    [{ search: '?x=1&city=Hanoi' }, true, 'Hanoi'],
    [{ search: '?city=' }, false, null], // an empty link brings no city
    [{ search: '?city=%20' }, false, null], // nor a blank one
    [{ search: '?city=+' }, false, null],
    [{ search: '?city=&city=Graz' }, false, null], // the page reads the first one, so the boot script must too
    [{ search: '?city=%20Graz%20' }, true, 'Graz'],
    [{ cookie: 'metablend_recent=%5B%5D' }, false, null], // an emptied list
    [{ cookie: 'metablend_recent=%5Bbroken' }, false, null], // unreadable: the page reads no cities either, so it must not wait for one
    [{ cookie: 'metablend_recent=%5Bbroken', last: 'Lienz' }, true, 'Lienz'],
  ]
  for (const [visitor, returning, city] of cases) {
    assert.equal(boot(visitor).returning, returning, JSON.stringify(visitor))
    const deepLink = deepLinkCity(visitor.search ?? '')
    let recent = []
    try { recent = JSON.parse(decodeURIComponent(/metablend_recent=(.*)/.exec(visitor.cookie ?? '')?.[1] ?? '[]')) } catch { /* as getRecent */ }
    assert.equal(startCity({ deepLink, last: visitor.last ?? null, recent }), city, JSON.stringify(visitor))
  }
})

test('APP_BOOT_SCRIPT — the app and framed pages never choose a landing page', () => {
  const app = 'Mozilla/5.0 (Linux; Android 15) MetaBlendApp'
  assert.equal(boot({ ua: app, last: 'Lienz' }).returning, false)
  assert.equal(boot({ ua: app, search: '?city=Hanoi' }).returning, false)
  assert.equal(boot({ framed: true, ua: app, last: 'Lienz' }).firstUse, false) // a framed page isn't the app
})

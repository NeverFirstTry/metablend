import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isAppRequest, APP_BOOT_SCRIPT, startCity, deepLinkCity, typedLink, showDebugLine, restoreAppMark } from './app-client.js'

test('typedLink — a place typed into the error or not-found screen\'s search goes into Recent; a link someone sent does not', () => {
  // that search is a plain form (it works without script), so it arrives as ?city= like a shared link
  const src = readFileSync(new URL('../app/components/ProblemScreen.jsx', import.meta.url), 'utf8')
  const hidden = [...src.matchAll(/<input type="hidden" name="(\w+)" value="(\w+)"/g)].map(m => [m[1], m[2]])
  assert.ok(hidden.length, 'the form marks itself as a search')
  const submitted = '?' + new URLSearchParams([['city', 'Los Angeles'], ...hidden])
  assert.equal(deepLinkCity(submitted), 'Los Angeles')
  assert.equal(typedLink(submitted), true)
  // a shared link, a widget, a notification, the city page's button
  assert.equal(typedLink('?city=Los%20Angeles'), false)
  assert.equal(typedLink(''), false)
  // the home page's first load remembers it only then
  const home = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')
  assert.match(home, /remember: first === deepLink && typedLink\(window\.location\.search\)/)
})

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

// What the boot script saw at first paint, kept on window for the diagnostic line
function bootStash({ ua = 'Mozilla/5.0', cookie = '' } = {}) {
  const html = { dataset: {}, style: { fontSize: '' } }
  const doc = { cookie, documentElement: html, querySelector: () => ({ content: '' }) }
  const win = {}
  win.top = win
  win.self = win
  new Function('window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', APP_BOOT_SCRIPT)(win, doc, { userAgent: ua }, { search: '' }, { getItem: () => null }, { getItem: () => null })
  return win.__mbBoot
}

test('APP_BOOT_SCRIPT — keeps its verdict, the user agent and the cookies it saw on window.__mbBoot', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MetaBlendApp'
  assert.deepEqual(bootStash({ ua }), { app: true, ua, cookie: 'metablend_app=1; path=/; max-age=2592000; samesite=lax' })
  assert.deepEqual(bootStash({ ua: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148', cookie: 'metablend_lang=de' }), { app: false, ua: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148', cookie: 'metablend_lang=de' })
})

test('showDebugLine — on ?debug=1 anywhere, and by itself inside a native shell the boot script did not recognise', () => {
  assert.equal(showDebugLine({ search: '?debug=1' }), true)
  assert.equal(showDebugLine({ search: '?city=Wien&debug=1' }), true)
  assert.equal(showDebugLine({ search: '?debug=10' }), false)
  assert.equal(showDebugLine({ native: true, marked: false }), true) // the broken state on the phone
  assert.equal(showDebugLine({ native: true, marked: true }), false) // the app working as it should
  assert.equal(showDebugLine({ native: false, marked: false }), false) // a plain web visitor
})

test('APP_BOOT_SCRIPT — records window errors from first paint on window.__mbErrors (React reports a failed hydration there)', () => {
  const html = { dataset: {}, style: { fontSize: '' } }
  const doc = { cookie: '', documentElement: html, querySelector: () => ({ content: '' }) }
  const listeners = {}
  const win = { addEventListener: (type, fn) => { listeners[type] = fn } }
  win.top = win
  win.self = win
  new Function('window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', APP_BOOT_SCRIPT)(win, doc, { userAgent: 'Mozilla/5.0 MetaBlendApp' }, { search: '' }, { getItem: () => null }, { getItem: () => null })
  assert.equal(html.dataset.app, '1') // the hook never gets in the way of the app mark
  listeners.error({ error: new Error('Minified React error #418; visit https://react.dev/errors/418') })
  listeners.error({ message: 'Script error.' })
  assert.deepEqual(win.__mbErrors, ['Minified React error #418; visit https://react.dev/errors/418', 'Script error.'])
})

test('restoreAppMark — puts <html data-app> back from the boot verdict when a rebuilt page lost it', () => {
  const wiped = { dataset: {} }
  assert.equal(restoreAppMark(wiped, { app: true }), true)
  assert.equal(wiped.dataset.app, '1')
  const web = { dataset: {} }
  assert.equal(restoreAppMark(web, { app: false }), false)
  assert.equal(web.dataset.app, undefined)
  assert.equal(restoreAppMark({ dataset: { app: '1' } }, undefined), true) // hydrated fine, nothing kept
})

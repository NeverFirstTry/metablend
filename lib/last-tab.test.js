// The app opens on the tab used last (UX review H5, owner: before launch): a hiker who closed the app on a peak
// starts the next morning on that peak, not on a city.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { APP_BOOT_SCRIPT } from './app-client.js'
import { START_KEY, RUN_KEY, keepStartTab } from './app-tabs.js'

// Runs the inline boot script against a fake page with storage that knows its keys.
function boot({ ua = 'Mozilla/5.0 MetaBlendApp', path = '/', search = '', saved = null, running = false, blocked = false } = {}) {
  const html = { dataset: {}, style: { fontSize: '' } }
  const local = { [START_KEY]: saved }
  const session = running ? { [RUN_KEY]: '1' } : {}
  const guard = () => { if (blocked) throw new Error('blocked') }
  const localStorage = { getItem: k => { guard(); return local[k] ?? null }, setItem: (k, v) => { guard(); local[k] = v } }
  const sessionStorage = { getItem: k => { guard(); return session[k] ?? null }, setItem: (k, v) => { guard(); session[k] = v } }
  const doc = { cookie: '', documentElement: html, querySelector: () => ({ content: '' }) }
  const win = {}
  win.top = win
  win.self = win
  new Function('window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', APP_BOOT_SCRIPT)(win, doc, { userAgent: ua }, { pathname: path, search }, localStorage, sessionStorage)
  return { resume: html.dataset.resumeTab ?? null, app: html.dataset.app === '1', session }
}

test('a cold start on the start page goes on to the Hiking screen it was left on', () => {
  assert.equal(boot({ saved: '/hike?peak=grossglockner' }).resume, '/hike?peak=grossglockner')
  assert.equal(boot({ saved: '/hike?peak=grossglockner&route=osm-1' }).resume, '/hike?peak=grossglockner&route=osm-1')
  assert.equal(boot({ saved: '/hike' }).resume, '/hike')
})

test('it stays on the start page: Forecast was last, nothing kept, the app already runs, a city link, the website', () => {
  assert.equal(boot({ saved: '/' }).resume, null)
  assert.equal(boot({ saved: null }).resume, null)
  // the Forecast tab reloads the page while the app runs: that is not a cold start
  assert.equal(boot({ saved: '/hike', running: true }).resume, null)
  assert.equal(boot({ saved: '/hike', search: '?city=Lienz' }).resume, null)
  assert.equal(boot({ saved: '/hike', path: '/more' }).resume, null)
  assert.equal(boot({ saved: '/hike', ua: 'Mozilla/5.0' }).resume, null)
  // storage blocked: the page starts as before, and the app mark is still set
  const blocked = boot({ saved: '/hike', blocked: true })
  assert.equal(blocked.resume, null)
  assert.equal(blocked.app, true)
})

test('only a Hiking address of this site is followed', () => {
  for (const bad of ['https://example.com/hike', '//example.com/hike', '/hikes', '/hike/../more', 'javascript:alert(1)']) {
    assert.equal(boot({ saved: bad }).resume, null, bad)
  }
})

test('the first page of a run marks the run, so later loads of the start page stay there', () => {
  assert.equal(boot({ saved: '/hike' }).session[RUN_KEY], '1')
  assert.equal(boot({ saved: null }).session[RUN_KEY], '1')
})

test('keepStartTab: Forecast and Hiking are kept, More is not', () => {
  const store = { v: {}, setItem(k, x) { this.v[k] = x } }
  keepStartTab('/hike?peak=ortler', store)
  assert.equal(store.v[START_KEY], '/hike?peak=ortler')
  keepStartTab('/more', store)
  keepStartTab('/more/settings', store)
  assert.equal(store.v[START_KEY], '/hike?peak=ortler')
  keepStartTab('/?city=Lienz', store) // the Forecast tab brings back its city itself
  assert.equal(store.v[START_KEY], '/')
  assert.doesNotThrow(() => keepStartTab('/hike', { setItem() { throw new Error('private mode') } }))
})

// source-match-ok: the wiring of three client components that need Next's router to render; the logic is tested above
test('the wiring: Hiking and Forecast keep the tab, the start page asks nothing while it goes on, the app goes there', () => {
  const hike = readFileSync(new URL('../app/components/hike/HikeApp.jsx', import.meta.url), 'utf8')
  const chrome = readFileSync(new URL('../app/components/AppChrome.jsx', import.meta.url), 'utf8')
  const home = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.match(hike, /keepStartTab\(href\)/)
  assert.match(chrome, /keepStartTab\('\/'\)/)
  assert.match(chrome, /dataset\.resumeTab/)
  assert.match(home, /else if \(!leaving\)/)
  assert.match(css, /html\[data-resume-tab\] main\.home \{ visibility: hidden; \}/)
  // on a slow line the way there takes seconds: the start page's small loader shows meanwhile, before any script
  assert.match(css, /html\[data-resume-tab\] main\.home \.returning-only \{ display: block; visibility: visible; \}/)
})

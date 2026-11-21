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
  // a tab tap during the way there wins, and the start page is never left hidden
  assert.match(chrome, /const leave = \(e, href\) => \{\s+tapHaptic\(\)\s+\/\/[^\n]*\n\s+endResume\(\)/)
  assert.match(home, /else if \(!leaving\)/)
  assert.match(css, /html\[data-resume-tab\] main\.home \{ visibility: hidden; \}/)
  // on a slow line the way there takes seconds: the start page's small loader shows meanwhile, before any script
  assert.match(css, /html\[data-resume-tab\] main\.home \.returning-only \{ display: block; visibility: visible; \}/)
})

test('endResume: the mark goes, and nothing breaks without a page', async () => {
  const { endResume } = await import('./app-tabs.js')
  const html = { dataset: { resumeTab: '/hike' } }
  endResume(html)
  assert.equal(html.dataset.resumeTab, undefined)
  assert.doesNotThrow(() => endResume(undefined))
})

// Fable's review: if the scripts never load, AppChrome never takes over and the start page would stay hidden for
// good; the boot script gives the mark six seconds, as it does the terms mark, unless the app took it over.
test('the resume mark goes after six seconds unless the app took it over', () => {
  const run = taken => {
    const html = { dataset: {}, style: { fontSize: '' } }
    const local = { [START_KEY]: '/hike?peak=ortler' }, session = {}
    const timers = []
    const win = { setTimeout: (fn, ms) => timers.push([fn, ms]) }
    win.top = win
    win.self = win
    new Function('window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', APP_BOOT_SCRIPT)(
      win, { cookie: '', documentElement: html, querySelector: () => ({ content: '' }) }, { userAgent: 'MetaBlendApp' }, { pathname: '/', search: '' },
      { getItem: k => local[k] ?? null, setItem: (k, v) => { local[k] = v } }, { getItem: k => session[k] ?? null, setItem: (k, v) => { session[k] = v } })
    assert.equal(html.dataset.resumeTab, '/hike?peak=ortler')
    const t = timers.find(([, ms]) => ms === 6000)
    assert.ok(t, 'a six-second timer')
    if (taken) html.dataset.resumeTaken = '1'
    t[0]()
    return html.dataset.resumeTab ?? null
  }
  assert.equal(run(false), null, 'no scripts: the start page shows again')
  assert.equal(run(true), '/hike?peak=ortler', 'the app took over: the mark stays until the Hiking screen is there')
})

// The start page is rendered on the server once an hour, the same HTML for everyone.
// The browser's first render must be that HTML, whatever the browser remembers
// (cookies, storage, the app mark): a difference makes React rebuild the page, and
// the rebuilt <html> loses the marks the boot scripts set before first paint. The
// app showed the website layout without its tab bar when the sources fold
// remembered being open (2026-11-08). Rendered here with react-dom/server twice:
// without a browser, and with a returning app user's browser. Remembered state
// is applied after hydration (effects), never in a first render.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: HomePage } = await import('../app/HomePage.jsx')
const { Fold } = await import('../app/components/ui.jsx')
const { exampleFrom } = await import('./landing.js')

const fixture = f => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'))
const forecast = fixture('forecast-vienna.json')
const example = { ...exampleFrom(forecast), forecast, outlook: fixture('outlook-vienna.json') }

const storage = entries => ({ getItem: k => entries[k] ?? null, setItem() {}, removeItem() {} })
// a returning app user's browser: recent cities, the sources fold left open, the app mark
const BROWSER = {
  window: { location: { search: '', pathname: '/', href: 'https://metablend.app/' }, matchMedia: () => ({ matches: false, addEventListener() {} }) },
  document: { cookie: 'metablend_app=1; metablend_recent=%5B%22Lienz%22%2C%22Vienna%22%5D; metablend_lang=de; metablend_unit=C', documentElement: { dataset: { app: '1' } } },
  navigator: { userAgent: 'Mozilla/5.0 (iPhone) MetaBlendApp', language: 'de-AT' },
  localStorage: storage({ mb_sources_open: '1', mb_forecast_last: 'lienz', metablend_text_scale: '1.2', metablend_tab: 'tomorrow' }),
  sessionStorage: storage({ metablend_last: 'Lienz' }),
}
BROWSER.window.self = BROWSER.window.top = BROWSER.window
// (Node has its own navigator and localStorage globals: swapped out, then put back)
const inBrowser = fn => {
  const before = Object.keys(BROWSER).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)])
  for (const [k, v] of Object.entries(BROWSER)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true })
  try { return fn() } finally {
    for (const [k, d] of before) if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]
  }
}
// the clock stands still, so "updated n min ago" can't differ between the two renders
const stillClock = fn => { const real = Date.now; Date.now = () => 1_762_635_600_000; try { return fn() } finally { Date.now = real } }
const firstDiff = (a, b) => {
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return `first difference at ${i}\n server: …${a.slice(Math.max(0, i - 100), i + 160)}…\n client: …${b.slice(Math.max(0, i - 100), i + 160)}…`
}

test('the start page: the browser’s first render is the server’s HTML, whatever the browser remembers', () => {
  const page = () => render(h(HomePage, { example, peaks: 42 }))
  const server = stillClock(page)
  const client = stillClock(() => inBrowser(page))
  assert.ok(server.includes('Vienna') && server.includes('Open-Meteo'), 'the example forecast is on the page')
  assert.ok(client === server, firstDiff(server, client))
})

test('Fold: a remembered "open" is applied after hydration, never in the first render', () => {
  const fold = () => render(h(Fold, { title: 'Sources', storeKey: 'mb_sources_open' }, h('p', null, 'Source spread')))
  const server = fold()
  assert.equal(server.includes('Source spread'), false)
  assert.equal(inBrowser(fold), server)
})

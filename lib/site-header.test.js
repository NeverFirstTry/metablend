// At phone width the website's header took three rows before any weather: logo, then units, theme, language and
// install, then five 20 px links (UX review W1, owner: before launch). Below lg it is now one row, the logo and a
// Menu button; the menu holds the links (44 px rows) and the settings. From lg up the header is as it was.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: SiteHeader } = await import('../app/components/SiteHeader.jsx')
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

const header = () => render(h(SiteHeader, { logo: h('a', { href: '/' }, 'MetaBlend'), lang: 'en', langPick: 'system', onLang: () => {}, unit: 'C', onUnit: () => {} }))

test('below lg: one Menu button, closed, naming what it opens; links and settings wait in the menu', () => {
  const html = header()
  assert.match(html, /<button[^>]*aria-expanded="false"[^>]*aria-controls="site-menu"[^>]*class="[^"]*lg:hidden[^"]*"[^>]*>.*Menu<\/button>/)
  assert.match(html, /<div id="site-menu" class="hidden lg:contents">/)
})

test('in the menu the links are 44 px rows; from lg up they stand in the row as before', () => {
  const html = header()
  const links = [...html.matchAll(/<a [^>]*>/g)].map(m => m[0]).filter(tag => /href="\/(leaderboard|heatmap|planner|hike|aviation)"/.test(tag))
  assert.equal(links.length, 5)
  for (const tag of links) assert.match(tag, /class="min-h-11 lg:min-h-0 /)
})

test('the button\'s word in every language', async () => {
  for (const l of LANGS) assert.ok((await import(`./i18n/${l}.js`)).default.siteMenu, l)
})

// The start page in the app opens on the answer (UX review S6, owner: before launch): it opened on logo, tagline,
// search, three buttons and two rows of places, with the forecast and its tabs below. For a returning user the
// app now starts at the place and its forecast; a tap on the place's name opens the search with the buttons and
// the places. The tagline shows on the first start only. The website keeps its search in view.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: HomePage } = await import('../app/HomePage.jsx')
const { exampleFrom } = await import('./landing.js')
const fixture = f => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'))
const forecast = fixture('forecast-vienna.json')
const page = render(h(HomePage, { example: { ...exampleFrom(forecast), forecast, outlook: fixture('outlook-vienna.json') }, peaks: 195 }))
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const home = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')

// source-match-ok: the block and the button are read from the rendered page, not from the source
test('the search, its buttons and the places sit in one block; the place name is the button that opens it', () => {
  const block = page.indexOf('id="home-search-block"')
  assert.ok(block > 0 && block < page.indexOf('class="home-search '), 'the block holds the search field')
  assert.match(page, /<button type="button"[^>]*aria-expanded="false"[^>]*aria-controls="home-search-block"/)
})

// source-match-ok: the style sheet's rules; the marks they read are set by the boot script before first paint
test('a returning user in the app starts at the forecast; the first start keeps the search and the tagline', () => {
  assert.match(css, /html\[data-app\]\[data-returning\] \.home-search-block:not\(\.open\) \{ display: none; \}/)
  assert.match(css, /html\[data-app\]\[data-returning\] \.home-tagline \{ display: none; \}/)
  assert.match(css, /html\[data-app\]\[data-returning\] \.home-now \{ margin-top: 1\.25rem; \}/)
})

// source-match-ok: the block opens on a tap, an error or compare, and closes after a load: state a static render cannot drive
test('the block opens for an error or compare, and closes once a place is loaded', () => {
  assert.match(home, /className=\{`home-search-block\$\{searchOpen \|\| error \|\| compareMode \? ' open' : ''\}`\}/)
  assert.match(home, /if \(!silent\) setSearchOpen\(false\)/)
})

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
const { searchFolds, searchBlockOpen } = await import('./home-search.js')
const fixture = f => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'))
const forecast = fixture('forecast-vienna.json')
const page = render(h(HomePage, { example: { ...exampleFrom(forecast), forecast, outlook: fixture('outlook-vienna.json') }, peaks: 195 }))
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const home = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')

// source-match-ok: the block and the heading are read from the rendered page, not from the source
test('the search, its buttons and the places sit in one block; on the website and at a first start the name is plain text', () => {
  const block = page.indexOf('id="home-search-block"')
  assert.ok(block > 0 && block < page.indexOf('class="home-search '), 'the block holds the search field')
  // Review, 2026-11-22: the button said collapsed over a search that was always in view
  assert.doesNotMatch(page, /aria-controls="home-search-block"/)
  const title = page.match(/<h2 class="mb-rise[^"]*">([\s\S]*?)<\/h2>/)?.[1] ?? ''
  assert.match(title, /Vienna/)
  assert.doesNotMatch(title, /<button/)
  // a long name ("Klosterneuburg," at 320 px) breaks inside the heading as on main, so the buttons move under it:
  // a flex box around the name kept the word whole and ran it under the refresh button (Design's shot, 2026-11-22)
  assert.doesNotMatch(title, /inline-flex/)
})

test('the search folds away only in the app, for a returning user', () => {
  assert.equal(searchFolds({ app: '1', returning: '1' }), true)
  assert.equal(searchFolds({ app: '1', firstUse: '1' }), false) // first start: the search stays in view
  assert.equal(searchFolds({ returning: '1' }), false) // the website marks a link to a place as returning too
  assert.equal(searchFolds({}), false)
  assert.equal(searchFolds(undefined), false)
})

test('the block is open after a tap, with an error and in compare, and only then', () => {
  assert.equal(searchBlockOpen({ tapped: false, error: null, compare: false }), false)
  assert.equal(searchBlockOpen({ tapped: true, error: null, compare: false }), true)
  assert.equal(searchBlockOpen({ tapped: false, error: 'Not found', compare: false }), true)
  assert.equal(searchBlockOpen({ tapped: false, error: null, compare: true }), true)
})

// source-match-ok: the button exists after mount in the app only, and its state follows taps: what a static render cannot drive
test('where it folds, the name is a button whose state is the block\'s, and its name says what it does', () => {
  assert.match(home, /const searchShown = searchBlockOpen\(\{ tapped: searchOpen, error, compare: compareMode \}\)/)
  assert.match(home, /className=\{`home-search-block\$\{searchShown \? ' open' : ''\}`\}/)
  assert.match(home, /\{folds \? \(\s*<button type="button" onClick=\{toggleSearch\} aria-expanded=\{searchShown\} aria-controls="home-search-block"/)
  // the button fills the heading as a block, so the name wraps and breaks there exactly as plain text does
  assert.match(home, /aria-controls="home-search-block"\s*className="press block w-full text-left">/)
  // the visible name stays the button's name, with what it does after it (not an aria-label, not a title)
  assert.match(home, /<span className="sr-only">, \{t\(lang, 'changePlace'\)\}<\/span>/)
  assert.doesNotMatch(home, /title=\{t\(lang, 'changePlace'\)\}/)
  // read once after mount (after the start may drop the mark), and dropped where the example replaces the place
  assert.match(home, /setFolds\(searchFolds\(document\.documentElement\.dataset\)\)\s*\/\* eslint-enable react-hooks\/set-state-in-effect \*\//)
  assert.match(home, /delete document\.documentElement\.dataset\.returning\s*setFolds\(false\)/)
})

// source-match-ok: the style sheet's rules; the marks they read are set by the boot script before first paint
test('a returning user in the app starts at the forecast; the first start keeps the search and the tagline', () => {
  assert.match(css, /html\[data-app\]\[data-returning\] \.home-search-block:not\(\.open\) \{ display: none; \}/)
  assert.match(css, /html\[data-app\]\[data-returning\] \.home-tagline \{ display: none; \}/)
  assert.match(css, /html\[data-app\]\[data-returning\] \.home-now \{ margin-top: 1\.25rem; \}/)
  // the chevron beside the name shows only where the search folds, from the first paint (the button comes after mount)
  assert.match(css, /\.home-fold-chevron \{ display: none; \}/)
  assert.match(css, /html\[data-app\]\[data-returning\] \.home-fold-chevron \{ display: inline-block; \}/)
})

// source-match-ok: the block opens on a tap, an error or compare, and closes after a load: state a static render cannot drive
test('the block opens for an error or compare, and closes once a place is loaded', () => {
  assert.match(home, /if \(!silent\) setSearchOpen\(false\)/)
})

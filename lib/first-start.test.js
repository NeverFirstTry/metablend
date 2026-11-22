// The app's first start (UX review 2026-11-20, F1 and F2; owner: before submission on 3 Dec): after
// "Continue" the product, not a pitch. The location card, the search field with the "Try a city" chips
// right under it, the example forecast the website already has, and one line to the mountains; no headline,
// sparkle or feature cards. "Use my location" is offered once: the button under the field steps aside while
// the card is there. The app's parts are chosen by CSS before first paint (html[data-app], [data-first-use]).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: HomePage } = await import('../app/HomePage.jsx')
const { exampleFrom } = await import('./landing.js')
const en = (await import('./i18n/en.js')).default

const fixture = f => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'))
const forecast = fixture('forecast-vienna.json')
const page = render(h(HomePage, { example: { ...exampleFrom(forecast), forecast, outlook: fixture('outlook-vienna.json') }, peaks: 195 }))
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('F1: the location card stands over the example too (the app with no place of its own)', () => {
  assert.ok(page.includes('first-use-only'), 'the card is in the page')
  assert.ok(page.indexOf('first-use-only') < page.indexOf('home-search'), 'above the search field')
})

test('F1: Try a city right under the search field, and one line to the mountains', () => {
  const start = page.indexOf('first-start'), search = page.indexOf('home-search'), forecastAt = page.indexOf('home-data')
  assert.ok(start > search && start < forecastAt, 'between the search field and the example forecast')
  const block = page.slice(start, forecastAt)
  assert.ok(block.includes(`>${en.welcomeTry}<`))
  for (const c of ['Vienna', 'Berlin', 'Tokyo']) assert.ok(block.includes(`>${c}</button>`), c)
  assert.match(block, /href="\/hike"/)
  assert.ok(block.includes(en.firstHike.replace('{n}', '195')), 'the line to the mountains names the peaks')
})

test('F1: no pitch in the app: no headline, no sparkle, no feature cards', () => {
  assert.ok(!page.includes('One forecast, every source.'), 'no headline') // the old welcome texts, gone from the packs
  assert.ok(!page.includes('Multi-source consensus'), 'no feature cards')
})

test('F1: the example forecast shows in the app, marked as an example, but not to a returning user', () => {
  assert.match(css, /html\[data-app\]:not\(\[data-returning\]\) \.home-data\.landing-view \{ display: block; \}/)
  assert.ok(page.includes(`>${en.exampleNote}<`), 'the example says it is one')
  // Fable's review: a user of Lienz saw Vienna's example and Try a city until the resume
  assert.match(css, /html\[data-returning\] \.first-start \{ display: none; \}/)
  assert.ok(page.includes('class="returning-only"'), 'a returning user gets the loader, in the app too')
})

test('F2: while the card is there, the location button under the field steps aside', () => {
  const locate = page.slice(page.indexOf('home-search'), page.indexOf('home-search') + 2500).match(/<button[^>]*aria-label="Use my location"[^>]*>/)?.[0] ?? ''
  assert.match(locate, /first-use-hide/)
  assert.match(css, /html\[data-first-use\] \.first-use-hide \{ display: none; \}/)
})

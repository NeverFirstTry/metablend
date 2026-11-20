// The tester's three points on the start page (UX review 2026-11-20, S1, S2, R1): the buttons under the
// search field say what they do, embed has left the row beside the place name (and the app), refresh and
// share are thumb-sized, and one place stands in Recent once whatever its spelling.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: HomePage } = await import('../app/HomePage.jsx')
const { exampleFrom } = await import('./landing.js')
const { uniquePlaces, samePlace } = await import('./recent-places.js')
const en = (await import('./i18n/en.js')).default

const fixture = f => JSON.parse(readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), 'utf8'))
const forecast = fixture('forecast-vienna.json')
const page = render(h(HomePage, { example: { ...exampleFrom(forecast), forecast, outlook: fixture('outlook-vienna.json') }, peaks: 42 }))
// the markup of one element, from its class to its closing tag (no nesting of the same tag inside)
const block = (cls, tag = 'div') => { const i = page.indexOf(cls); return i < 0 ? '' : page.slice(i, page.indexOf(`</${tag}>`, page.indexOf('>', i))) }
const buttons = html => html.match(/<button[\s\S]*?<\/button>/g) ?? []

test('S1: the location, compare and save buttons under the search field carry their word', () => {
  const row = page.slice(page.indexOf('home-search'), page.indexOf('home-search') + 6000)
  for (const word of [en.locateShort, en.compareBtn, en.saveShort]) assert.ok(row.includes(`>${word}</span>`), `"${word}" is written on its button`)
})

test('S2: beside the place name only refresh and share, both 44 px; embed is a website fold further down', () => {
  const actions = buttons(block('home-actions'))
  assert.equal(actions.length, 2, 'refresh and share')
  for (const b of actions) assert.match(b, /\b(size-11|h-11 min-w-11)\b/, 'a 44 px target')
  assert.ok(!block('home-actions').includes(en.embedBtn), 'no embed beside the name')
  const fold = page.indexOf(`>${en.embedBtn}<`)
  assert.ok(fold > page.indexOf('home-more'), 'the embed fold comes after the forecast')
  assert.ok(page.lastIndexOf('web-only', fold) > page.indexOf('home-more'), 'and only on the website')
})

test('R1: one place once in Recent, whatever its accents or case; the newest spelling stays', () => {
  assert.deepEqual(uniquePlaces(['Buôn Ma Thuột', 'Buon Ma Thuot', 'Lienz', 'lienz', 'Wien']), ['Buôn Ma Thuột', 'Lienz', 'Wien'])
  assert.equal(samePlace('Buôn Ma Thuột', 'buon ma thuot'), true)
  assert.equal(samePlace('Wien', 'Vienna'), false) // the same town in two languages needs its position: not stored yet
  assert.deepEqual(uniquePlaces('not a list'), [])
  assert.deepEqual(uniquePlaces([' Lienz', 42, 'Lienz']), [' Lienz']) // only names, compared trimmed
})

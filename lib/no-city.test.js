import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { startCity, deepLinkCity } from './app-client.js'

// Every way a page can end up without a city must land on the first-visit default
// (the Vienna example with its note), never on an empty page.
const home = readFileSync('app/HomePage.jsx', 'utf8').replace(/\r\n/g, '\n')
const fn = name => home.slice(home.indexOf(`function ${name}(`), home.indexOf('\n  }\n', home.indexOf(`function ${name}(`)))

test('showExample brings back the example, its note and the page, and lifts the returning mark', () => {
  const body = fn('showExample')
  for (const part of ['setData(example.forecast)', 'setOutlook(example.outlook', 'setIsExample(true)', "delete document.documentElement.dataset.returning"]) assert.ok(body.includes(part), part)
})

test('the logo with no saved city (after removing the last place or Clear all) shows the example', () => {
  assert.equal(startCity({ deepLink: null, recent: [] }), null) // nothing saved: no city to go to
  assert.match(fn('resetToStart'), /showExample\(\)/)
})

test('removing places keeps the forecast on screen; the next visit or logo click starts from the example', () => {
  assert.doesNotMatch(fn('forgetRecent'), /setData\(null\)/)
  assert.doesNotMatch(fn('forgetAllRecent'), /setData\(null\)/)
})

test('a bad or blank ?city= link: blank means no city; a failed load without a place of their own keeps the example', () => {
  // source-match-ok: a branch in loadForecast's catch, reachable only with effects and a failing fetch, no DOM here
  assert.equal(deepLinkCity('?city=%20'), null)
  assert.equal(deepLinkCity('?city='), null)
  // since 2026-11-20 the error carries Try again (setErrorRetry, UX review Y1), since 2026-11-21 whether it was a
  // not-found (R4: places to try instead of Try again); the example still follows
  assert.match(home, /setError\(text\)\r?\n\s*setErrorRetry\(\{ text, q, notFound: e\.status === 404 \}\)\r?\n\s*if \(!ownCity\.current\) showExample\(\)/)
})

test('a failed location lookup only shows its error: whatever was on screen stays', () => {
  const body = fn('handleLocation')
  assert.doesNotMatch(body, /setData\(null\)/)
})

test('the language pages and the app use the same page: the example is the start state when no place is saved', () => {
  // source-match-ok: initial-state pins; the rendered example start page is tested in first-render.test.js
  assert.match(home, /useState\(\(\) => SESSION\.data \?\? example\?\.forecast \?\? null\)/)
  // the app shows its own first screen over the example
  assert.match(home, /\(!data \|\| isExample\) && !loading && !error && !compareMode/)
})

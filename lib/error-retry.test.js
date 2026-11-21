// The start page's error box (UX review 2026-11-20, Y1; owner: before submission on 3 Dec): a forecast that
// could not be loaded offers Try again in the box, and a phone without a connection is told so instead of
// "could not be loaded". The box is reached only by a failed request, so these checks read the code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LANGUAGES } from './i18n.js'

const page = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')
const box = page.slice(page.indexOf('{/* Error */}'), page.indexOf('{/* A search in flight'))

test('the error box has a Try again button that loads the same place again', () => {
  // source-match-ok: the box shows only after a failed load in an effect, and these tests have no DOM
  assert.match(box, /<button[\s\S]*onClick=\{\(\) => loadForecast\(errorRetry\.q\)\}/)
  assert.match(box, /t\(lang, 'retry'\)/)
  assert.match(box, /min-h-11/, 'a 44 px target')
  // shown only for the error it belongs to: a later location error does not get a forecast retry
  assert.match(box, /errorRetry\?\.text === error/)
})

test('offline without a stored forecast for the place: the box says so', async () => {
  // source-match-ok: the offline branch needs effects, a failing fetch and navigator.onLine false, no DOM here
  assert.match(page, /genuinelyOffline \? t\(asLang, 'offlineNoStored'\) : e\.message/)
  for (const { code } of LANGUAGES) {
    const { default: pack } = await import(`./i18n/${code}.js`)
    assert.ok(pack.offlineNoStored && !/[–—]/.test(pack.offlineNoStored), code)
  }
})

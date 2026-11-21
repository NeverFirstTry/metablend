// The app's own offline screen (mobile/www/index.html, shipped inside the native build, shown when the app
// starts without a connection): it speaks the phone's language in all 13 of the app's languages, keeps the
// house rules (no dashes, no "safe"), uses the app's type instead of a monospace face, and its one button
// is a 44 px target (UX review 2026-11-20, Y4; owner: before submission on 3 Dec).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LANGUAGES } from './i18n.js'

const html = readFileSync(new URL('../mobile/www/index.html', import.meta.url), 'utf8')
const texts = JSON.parse(html.match(/<script type="application\/json" id="texts">([\s\S]*?)<\/script>/)?.[1] ?? '{}')

test('every app language has its title, sentence and button', () => {
  for (const { code } of LANGUAGES) {
    const x = texts[code]
    assert.ok(x?.title && x?.text && x?.retry, `${code} is complete`)
    for (const s of Object.values(x)) {
      assert.ok(!/[–—]/.test(s), `${code}: no dash in "${s}"`)
      assert.ok(!/\b(safe|sicher)\b/i.test(s), `${code}: no promise of safety`)
    }
  }
  assert.equal(Object.keys(texts).length, LANGUAGES.length, 'no language beyond the app\'s')
})

test('the page without its script reads in English, in the app\'s type, with a 44 px button', () => {
  for (const s of Object.values(texts.en)) assert.ok(html.includes(`>${s}<`), `"${s}" stands in the page`)
  assert.ok(!/monospace/.test(html), 'no monospace face')
  assert.match(html, /-apple-system/, 'the app\'s font stack')
  assert.match(html, /min-height:\s*44px/, 'the button is a 44 px target')
  assert.match(html, /prefers-color-scheme:\s*light/, 'follows the phone\'s light appearance')
})

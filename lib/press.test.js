import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PRESS, PRESS_KIT, pressFor } from './press.js'
import { SAFE, CLAIMS, CHEAP, DASH } from './wording.js'

const texts = p => [p.title, p.intro, p.factsTitle, ...p.facts.flat(), p.contactTitle, p.storesTitle, p.storesSoon, p.kitTitle, p.kitText, p.kitButton, ...p.kitItems, p.previewDark, p.previewLight, p.previewIcon]

// the press page and the kit's README speak for MetaBlend to journalists: the store's rules hold
test('press texts — English and German, no dash, no safety word, no reliability claim, no bargain word', () => {
  for (const lang of ['en', 'de']) for (const s of texts(PRESS[lang])) {
    assert.doesNotMatch(s, DASH, `${lang}: ${s}`)
    assert.doesNotMatch(s, SAFE[lang], `${lang}: ${s}`)
    assert.doesNotMatch(s, CLAIMS[lang], `${lang}: ${s}`)
    if (CHEAP[lang]) assert.doesNotMatch(s, CHEAP[lang], `${lang}: ${s}`)
  }
  assert.deepEqual(Object.keys(PRESS.de), Object.keys(PRESS.en))
  assert.equal(PRESS.de.facts.length, PRESS.en.facts.length)
  assert.equal(PRESS.de.kitItems.length, PRESS.en.kitItems.length)
})

test('pressFor — German readers get German, everyone else English', () => {
  assert.equal(pressFor('de'), PRESS.de)
  for (const lang of ['en', 'fr', 'ja', undefined]) assert.equal(pressFor(lang), PRESS.en)
})

test('press kit — the zip and the previews /press shows are in public/', () => {
  for (const f of [PRESS_KIT, '/press/metablend-wordmark-dark.svg', '/press/metablend-wordmark-light.svg', '/press/metablend-mark-dark.svg', '/press/metablend-app-icon.png']) {
    assert.ok(fs.existsSync(`public${f}`), f)
  }
  for (const f of ['/press/metablend-wordmark-dark.svg', '/press/metablend-mark-dark.svg']) assert.doesNotMatch(fs.readFileSync(`public${f}`, 'utf8'), /NaN/, f)
})

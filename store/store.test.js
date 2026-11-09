import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { LOCALES } from './locales.js'

const root = new URL('../', import.meta.url)
const read = p => fs.readFileSync(new URL(p, root), 'utf8').trim()
const len = s => [...s].length
const IOS = { 'name.txt': 30, 'subtitle.txt': 30, 'promotional_text.txt': 170, 'description.txt': 4000, 'keywords.txt': 100, 'release_notes.txt': 4000 }
const ANDROID = { 'title.txt': 30, 'short_description.txt': 80, 'full_description.txt': 4000, 'changelogs/1.txt': 500 }
const URLS = { 'privacy_url.txt': 'https://metablend.app/privacy', 'support_url.txt': 'https://metablend.app/support', 'marketing_url.txt': 'https://metablend.app' }
// TODO/TBD only in capitals: Spanish "todo" is a real word
const JUNK = /TODO|TBD|[Ll]orem|\{\w+\}/

test('locales — 13 app languages, iOS without Slovenian', () => {
  assert.deepEqual(LOCALES.map(l => l.lang), ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko'])
  assert.deepEqual(LOCALES.filter(l => l.ios).map(l => l.ios), ['en-US', 'de-DE', 'fr-FR', 'es-ES', 'it', 'nl-NL', 'pl', 'cs', 'pt-BR', 'ja', 'zh-Hans', 'ko'])
  assert.deepEqual(LOCALES.map(l => l.android), ['en-US', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'nl-NL', 'pl-PL', 'cs-CZ', 'sl', 'pt-BR', 'ja-JP', 'zh-CN', 'ko-KR'])
})

test('App Store texts — every locale, every file, within its limit', () => {
  for (const { ios } of LOCALES.filter(l => l.ios)) {
    for (const [file, max] of Object.entries(IOS)) {
      const s = read(`fastlane/metadata/${ios}/${file}`)
      assert.ok(s && len(s) <= max, `${ios}/${file}: ${len(s)} > ${max}`)
      assert.doesNotMatch(s, JUNK, `${ios}/${file}`)
    }
    for (const [file, url] of Object.entries(URLS)) assert.equal(read(`fastlane/metadata/${ios}/${file}`), url)
    assert.doesNotMatch(read(`fastlane/metadata/${ios}/keywords.txt`), /, /, `${ios} keywords: no space after commas`)
  }
  // App Store copyright is one field for all languages: the year of first publication and the owner
  assert.equal(read('fastlane/metadata/copyright.txt'), '2026 Rene Kostmann')
})

test('Play texts — every locale, every file, within its limit', () => {
  for (const { android } of LOCALES) {
    for (const [file, max] of Object.entries(ANDROID)) {
      const s = read(`fastlane/metadata/android/${android}/${file}`)
      assert.ok(s && len(s) <= max, `${android}/${file}: ${len(s)} > ${max}`)
      assert.doesNotMatch(s, JUNK, `${android}/${file}`)
    }
  }
})

// the listings said 16, then 26 sources; production has up to 20 since 2026-10-29
test('no store text or caption names an old source count (16 or 26)', () => {
  const texts = fs.readdirSync(new URL('fastlane/metadata/', root), { recursive: true })
    .filter(f => f.endsWith('.txt')).map(f => `fastlane/metadata/${f.replaceAll('\\', '/')}`)
  assert.ok(texts.length > 150, `${texts.length} store texts found`)
  for (const f of [...texts, 'store/captions.json']) assert.doesNotMatch(read(f), /(?<!\d)(16|26)(?!\d)/, f)
})

test('TestFlight review texts exist', () => {
  assert.equal(read('fastlane/metadata/review/feedback_email.txt'), 'info@metablend.app')
  for (const f of ['beta_description.txt', 'what_to_test.txt']) assert.ok(len(read(`fastlane/metadata/review/${f}`)) > 50, f)
})

test('captions — 5 per app language, short enough for two lines', () => {
  const c = JSON.parse(read('store/captions.json'))
  for (const { lang } of LOCALES) {
    assert.equal(c[lang]?.length, 5, lang)
    for (const s of c[lang]) assert.ok(s && len(s) <= 48, `${lang}: ${s}`)
  }
})

test('Play release notes — the version being built has them in every locale, within 500 characters', () => {
  const code = read('mobile/android/app/build.gradle').match(/versionCode (\d+)/)[1]
  for (const { android } of LOCALES) {
    const s = read(`fastlane/metadata/android/${android}/changelogs/${code}.txt`)
    assert.ok(s && len(s) <= 500, `${android}/changelogs/${code}.txt: ${len(s)} > 500`)
    assert.doesNotMatch(s, JUNK, `${android}/changelogs/${code}.txt`)
  }
})

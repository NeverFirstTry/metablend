import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLang, langChoice, preferredLang, LANG_SYSTEM, tn, LANGUAGES } from './i18n.js'

test('detectLang — a browser language or a whole Accept-Language header', () => {
  assert.equal(detectLang('de-AT'), 'de')
  assert.equal(detectLang('de,en-US;q=0.7,en;q=0.3'), 'de') // German Firefox's header
  assert.equal(detectLang('fr-FR,fr;q=0.9'), 'fr')
  assert.equal(detectLang('sv-SE'), 'en')
  assert.equal(detectLang(undefined), 'en')
})

test('preferredLang — the chosen language, else the phone\'s, never a silent English', async () => {
  const { preferredLang } = await import('./i18n.js')
  assert.equal(preferredLang('fr', 'de-AT'), 'fr')
  assert.equal(preferredLang(null, 'de-AT'), 'de')
  assert.equal(preferredLang(undefined, 'it-IT,it;q=0.9'), 'it')
  assert.equal(preferredLang('xx', 'es-ES'), 'es') // a junk cookie doesn't win
  assert.equal(preferredLang(null, undefined), 'en')
})

test('langChoice — a picked language, otherwise "system" (follow the phone)', () => {
  assert.equal(LANG_SYSTEM, 'system')
  assert.equal(langChoice('de'), 'de')
  assert.equal(langChoice(null), 'system')
  assert.equal(langChoice(''), 'system')
  assert.equal(langChoice('system'), 'system')
  assert.equal(langChoice('xx'), 'system')
})

test('preferredLang — "system" or nothing picked: the phone language, English when we lack it', () => {
  assert.equal(preferredLang('system', 'de-AT'), 'de')
  assert.equal(preferredLang(null, 'it-IT'), 'it')
  assert.equal(preferredLang(null, 'sv-SE'), 'en')
  assert.equal(preferredLang('fr', 'de-AT'), 'fr')
})

test('tn — the singular text for exactly one, the plural otherwise, the count filled in', () => {
  assert.equal(tn('en', 'hikeModels', 1), '1 weather model')
  assert.equal(tn('en', 'hikeModels', 9), '9 weather models')
  assert.equal(tn('de', 'hikeModels', 1), '1 Wettermodell')
  assert.equal(tn('it', 'lbLearning', 1).includes('1'), true)
  assert.equal(tn('en', 'updatedAgo', 1), 'updated 1 min ago') // no singular text: the plural one
})

test('detectLang — the new languages; Traditional Chinese falls back to English', () => {
  for (const [tag, want] of [['nl-NL', 'nl'], ['pl', 'pl'], ['cs-CZ', 'cs'], ['sl-SI', 'sl'], ['pt-BR', 'pt'], ['pt-PT', 'pt'],
    ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['zh', 'zh'], ['zh-CN', 'zh'], ['zh-Hans-CN', 'zh'], ['zh-SG', 'zh'],
    ['zh-TW', 'en'], ['zh-HK', 'en'], ['zh-MO', 'en'], ['zh-Hant-TW', 'en'], ['zh-TW,zh;q=0.9', 'en']]) {
    assert.equal(detectLang(tag), want, tag)
  }
  assert.deepEqual(LANGUAGES.map(l => l.code), ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko'])
})

test('tn — Polish, Czech and Slovenian counts take their own forms', () => {
  const forms = (lang, ns) => new Set(ns.map(n => tn(lang, 'hikeModels', n).replace(/\d+/g, '#'))).size
  assert.equal(forms('pl', [1, 2, 5]), 3)
  assert.equal(forms('cs', [1, 2, 5]), 3)
  assert.equal(forms('sl', [1, 2, 3, 5]), 4)
})

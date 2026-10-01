import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLang, langChoice, preferredLang, LANG_SYSTEM } from './i18n.js'

test('detectLang — a browser language or a whole Accept-Language header', () => {
  assert.equal(detectLang('de-AT'), 'de')
  assert.equal(detectLang('de,en-US;q=0.7,en;q=0.3'), 'de') // German Firefox's header
  assert.equal(detectLang('fr-FR,fr;q=0.9'), 'fr')
  assert.equal(detectLang('pt-BR'), 'en')
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
  assert.equal(preferredLang(null, 'ja-JP'), 'en')
  assert.equal(preferredLang('fr', 'de-AT'), 'fr')
})

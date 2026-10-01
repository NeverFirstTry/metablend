import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLang } from './i18n.js'

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

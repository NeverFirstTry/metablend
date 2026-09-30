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

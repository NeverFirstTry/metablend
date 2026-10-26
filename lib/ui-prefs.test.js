import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publishPrefs, subscribePrefs, knownLang, knownUnit, cookiePrefs } from './ui-prefs.js'

test('ui-prefs — unknown until a page has worked them out; then every later mount reads them at once', () => {
  assert.equal(knownLang(), null)
  assert.equal(knownUnit(), null)
  const seen = []
  const off = subscribePrefs(() => seen.push([knownLang(), knownUnit()]))
  publishPrefs({ lang: 'de' })
  publishPrefs({ unit: 'F' })
  publishPrefs({ lang: 'de', unit: 'F' }) // nothing new: nobody is told
  assert.deepEqual(seen, [['de', null], ['de', 'F']])
  off()
  publishPrefs({ lang: 'ja' })
  assert.equal(seen.length, 2)
  assert.equal(knownLang(), 'ja')
})

test('cookiePrefs — the language and unit the cookies (or the phone, for "System") ask for', () => {
  assert.deepEqual(cookiePrefs('metablend_lang=de; metablend_unit=F', 'en-US'), { lang: 'de', unit: 'F' })
  assert.deepEqual(cookiePrefs('metablend_consent=1', 'ja-JP'), { lang: 'ja', unit: 'C' }) // System: the phone's language
  assert.deepEqual(cookiePrefs('', 'vi-VN'), { lang: 'en', unit: 'C' }) // a language we don't have
})

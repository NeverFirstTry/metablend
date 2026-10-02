import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsLocalePass, LOCALE_BOOT_SCRIPT } from './locale-boot.js'

// runs the inline <script> against a fake page; true when it marks <html data-localizing>
const runScript = (cookie, language) => {
  const html = { dataset: {} }
  new Function('document', 'navigator', LOCALE_BOOT_SCRIPT)({ cookie, documentElement: html }, { language })
  return html.dataset.localizing === '1'
}

const CASES = [
  // cookie, phone language, expected
  ['', 'en-US', false],
  ['', 'de-AT', true],
  ['', 'sv-SE', false], // a language we don't have: English, nothing to swap
  ['metablend_lang=en', 'de-AT', false], // English picked by hand
  ['metablend_lang=fr', 'en-GB', true],
  ['metablend_unit=F', 'en-US', true], // °F is swapped in too
  ['a=1; metablend_lang=it; metablend_unit=C', 'en-US', true],
  ['metablend_lang=xx', 'en-US', false],
]

test('needsLocalePass — only when the page would first paint the wrong language or unit', () => {
  for (const [cookie, lang, want] of CASES) assert.equal(needsLocalePass({ cookie, navigatorLang: lang }), want, `${cookie} | ${lang}`)
})

test('LOCALE_BOOT_SCRIPT — the inline script decides exactly like needsLocalePass', () => {
  for (const [cookie, lang, want] of CASES) assert.equal(runScript(cookie, lang), want, `${cookie} | ${lang}`)
})

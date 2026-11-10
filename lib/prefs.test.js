import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { readCookie, setCookie, clearCookie } from './prefs.js'

test('readCookie — exact name, decoded, null when missing', () => {
  assert.equal(readCookie('a=1; metablend_lang=de; b=2', 'metablend_lang'), 'de')
  assert.equal(readCookie('xmetablend_lang=fr', 'metablend_lang'), null)
  assert.equal(readCookie('metablend_recent=%5B%22Wien%22%5D', 'metablend_recent'), '["Wien"]')
  assert.equal(readCookie('', 'x'), null)
})

test('setCookie / clearCookie — Secure and SameSite=Lax on every preference cookie; the app flag cookie too', () => {
  // source-match-ok: AppFlag writes its cookie in an effect, no DOM here; setCookie's flags are tested by calling it above
  const had = Object.hasOwn(globalThis, 'document'), saved = globalThis.document
  globalThis.document = { cookie: '' }
  try {
    setCookie('metablend_unit', 'F')
    assert.match(globalThis.document.cookie, /^metablend_unit=F; expires=[^;]+; path=\/; SameSite=Lax; Secure$/)
    clearCookie('metablend_unit')
    assert.match(globalThis.document.cookie, /^metablend_unit=; expires=[^;]+; path=\/; SameSite=Lax; Secure$/)
  } finally {
    if (had) globalThis.document = saved; else delete globalThis.document
  }
  const flag = fs.readFileSync(new URL('../app/hike/AppFlag.jsx', import.meta.url), 'utf8')
  assert.equal((flag.match(/document\.cookie = `[^`]*; secure`/gi) ?? []).length, 2)
})

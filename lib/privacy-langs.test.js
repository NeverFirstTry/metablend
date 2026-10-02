import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { LANGUAGES } from './i18n.js'

test('the privacy page has a full notice for every language', () => {
  const src = fs.readFileSync(new URL('../app/privacy/content.jsx', import.meta.url), 'utf8')
  for (const { code } of LANGUAGES) assert.match(src, new RegExp(`^  ${code}: \\{$`, 'm'), `privacy ${code}`)
  assert.equal((src.match(/updated: '/g) ?? []).length, LANGUAGES.length)
})

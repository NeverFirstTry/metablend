import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { LANGUAGES } from './i18n.js'

test('the privacy page has a full notice for every language', () => {
  const src = fs.readFileSync(new URL('../app/privacy/content.jsx', import.meta.url), 'utf8')
  for (const { code } of LANGUAGES) assert.match(src, new RegExp(`^  ${code}: \\{$`, 'm'), `privacy ${code}`)
  assert.equal((src.match(/updated: '/g) ?? []).length, LANGUAGES.length)
})

test('every language explains the Android tester sign-up (what, why, how long, how to delete) and has as many sections as English', () => {
  const src = fs.readFileSync(new URL('../app/privacy/content.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const blocks = src.split(/\n {2}(?=[a-z]{2}: \{\n)/).slice(1).map(b => b.slice(0, b.indexOf('\n  },')))
  assert.equal(blocks.length, LANGUAGES.length)
  const sections = b => (b.match(/^ {6}\{ title: '/gm) ?? []).length
  for (const b of blocks) {
    const code = b.slice(0, 2)
    assert.equal(sections(b), sections(blocks[0]), `privacy ${code}: sections`)
    assert.match(b, /Google Play[^\n]*info@metablend\.app/, `privacy ${code}: tester sign-up`)
  }
})

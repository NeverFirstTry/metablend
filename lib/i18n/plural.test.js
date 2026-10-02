import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pluralKey, tn } from '../i18n.js'

const has = keys => k => keys.includes(k)

test('pluralKey — the language plural category picks the form, else the base key', () => {
  const pl = has(['mOne', 'mFew', 'mMany'])
  assert.deepEqual([1, 2, 4, 5, 12, 22, 25].map(n => pluralKey('pl', 'm', n, pl)), ['mOne', 'mFew', 'mFew', 'mMany', 'mMany', 'mFew', 'mMany'])
  const sl = has(['mOne', 'mTwo', 'mFew'])
  assert.deepEqual([1, 2, 3, 5, 101, 102].map(n => pluralKey('sl', 'm', n, sl)), ['mOne', 'mTwo', 'mFew', 'm', 'mOne', 'mTwo'])
  assert.deepEqual([1, 2, 5].map(n => pluralKey('cs', 'm', n, has(['mOne', 'mFew']))), ['mOne', 'mFew', 'm'])
  assert.equal(pluralKey('ja', 'm', 1, has(['mOne'])), 'm') // no singular in Japanese
  assert.equal(pluralKey('en', 'm', 1, has(['mOne'])), 'mOne')
  assert.equal(pluralKey('en', 'm', 1, has([])), 'm')
})

test('tn — English singular and plural as before', () => {
  assert.equal(tn('en', 'hikeModels', 1), tn('en', 'hikeModelsOne', 1))
  assert.match(tn('en', 'hikeModels', 9), /9/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cityName } from './city-names.js'
import { CITIES } from './cities.js'

test('cityName: the local name, the English one where it is the same', () => {
  assert.equal(cityName('vienna', 'de', 'Vienna'), 'Wien')
  assert.equal(cityName('vienna', 'it', 'Vienna'), 'Vienna')
  assert.equal(cityName('vienna', 'en', 'Vienna'), 'Vienna')
})

test('cityName: a city outside the list keeps the name it came with', () => {
  assert.equal(cityName('lienz', 'de', 'Lienz'), 'Lienz')
})

test('cityName: all 54 listed cities have their Japanese, Chinese and Korean names', () => {
  assert.equal(CITIES.length, 54)
  for (const { slug, name } of CITIES) {
    for (const lang of ['ja', 'zh', 'ko']) assert.notEqual(cityName(slug, lang, name), name, `${slug} ${lang}`)
  }
})

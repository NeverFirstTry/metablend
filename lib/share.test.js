import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cityShareUrl, shareText, widgetPath, embedCode, pickLang, pickTheme } from './share.js'

test('cityShareUrl — the city page, with the sharer\'s language and a non-default unit', () => {
  assert.equal(cityShareUrl({ city: 'Vienna', lang: 'de', unit: 'C' }), 'https://metablend.app/city/Vienna?lang=de')
  assert.equal(cityShareUrl({ city: 'São Paulo', lang: 'xx', unit: 'F' }), 'https://metablend.app/city/S%C3%A3o%20Paulo?lang=en&unit=F')
})

test('shareText — separators around the weather, the sources line in the language', () => {
  assert.equal(shareText('en', { city: 'Vienna', temp: '18°', condition: 'Clear', sources: 11, agree: 90 }),
    'Vienna · 18° · Clear\n11 weather sources, 90% agree – via MetaBlend')
  assert.equal(shareText('de', { city: 'Wien', temp: '18°', condition: '', sources: 9, agree: 71 }),
    'Wien · 18°\n9 Wetterquellen, 71 % Einigkeit – via MetaBlend')
})

test('widgetPath / embedCode — defaults stay out of the URL, the code is safe to paste', () => {
  assert.equal(widgetPath({ city: 'Vienna', lang: 'en', unit: 'C', theme: 'auto' }), '/widget/Vienna?lang=en')
  assert.equal(widgetPath({ city: 'Vienna', lang: 'fr', unit: 'F', theme: 'light' }), '/widget/Vienna?lang=fr&unit=F&theme=light')
  const code = embedCode({ city: 'A"B', lang: 'en', unit: 'C', theme: 'dark', size: 'wide' })
  assert.match(code, /^<iframe src="https:\/\/metablend\.app\/widget\/A%22B\?lang=en&amp;theme=dark" width="480" height="180"/)
  assert.match(code, /title="MetaBlend · A&quot;B"/)
  assert.match(embedCode({ city: 'X', size: 'huge' }), /width="300" height="200"/)
})

test('pickers fall back to safe defaults', () => {
  assert.equal(pickLang('it'), 'it')
  assert.equal(pickLang('<x>'), 'en')
  assert.equal(pickTheme('light'), 'light')
  assert.equal(pickTheme('neon'), 'auto')
})

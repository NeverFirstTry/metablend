import test from 'node:test'
import assert from 'node:assert/strict'
import { lines, sortOf, PAGE_FILE } from './layout-cut-off-report.mjs'

const weight = { view: 'app', page: 'forecast', path: '/', kind: 'sticks out', el: 'th.font-normal', text: 'Weight', by: 7, side: 'right', clip: 'main.home', clipWidth: 320, decor: false, faint: false }

test('one line per element, clipping box and page, with the languages, widths and views it was met in and the largest overhang', () => {
  const all = lines([
    { ...weight, lang: 'en', width: 320 },
    { ...weight, lang: 'fr', width: 320, by: 14, text: 'Poids' },
    { ...weight, lang: 'fr', width: 320, view: 'website', by: 12, text: 'Poids' },
    { ...weight, lang: 'fr', width: 320, page: 'rankings', el: 'button.press', text: 'Semaine', by: 40, view: 'website' },
  ], { langs: ['en', 'de', 'fr'], widths: [320, 360, 390] })
  assert.equal(all.length, 2)
  const [first, second] = all
  assert.deepEqual([first.file, first.page, first.langs, first.widths, first.views, first.by, first.at, first.seen], ['app/HomePage.jsx', 'forecast', ['en', 'fr'], [320], ['app', 'website'], 14, 'fr, 320 px, app', 3])
  assert.deepEqual(first.texts, ['Weight', 'Poids'])
  assert.deepEqual([second.file, second.page, second.by], ['app/leaderboard/page.js', 'rankings', 40])
})

test('what a line is: content first; a map in its frame, screen-reader text, ornaments and transparent things are listed after it, never left out', () => {
  assert.equal(sortOf(weight), 'content')
  assert.equal(sortOf({ ...weight, el: 'img.leaflet-tile', clip: 'div.h-64.overflow-hidden' }), 'map inside its frame')
  assert.equal(sortOf({ ...weight, clip: 'thead', clipWidth: 1 }), 'text for screen readers')
  assert.equal(sortOf({ ...weight, decor: true }), 'ornament')
  assert.equal(sortOf({ ...weight, faint: true }), 'transparent just then')
  assert.equal(sortOf({ ...weight, kind: 'shortened (…)', clipWidth: undefined }), 'content')
  const all = lines([{ ...weight, lang: 'de', width: 390, el: 'img.leaflet-tile', page: 'heatmap' }, { ...weight, lang: 'de', width: 390 }], { langs: ['de'], widths: [390] })
  assert.deepEqual(all.map(l => l.sort), ['content', 'map inside its frame'])
  assert.equal(PAGE_FILE.heatmap, 'app/heatmap/page.js')
})

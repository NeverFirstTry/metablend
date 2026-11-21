// House rules the UX review of 2026-11-20 found broken where lib/wording.test.js does not look (X5, A2):
// no emoji in interface text (they differ on every phone and a screen reader reads "globe showing Americas";
// the app's own icons stand in), and no em or en dash in the aviation pages, whose English is in the page
// files, not in the language packs. Push titles keep theirs: they are notifications, not the interface.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LANGUAGES } from './i18n.js'

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const SHOWN = ['regionGlobal', 'regionEurope', 'regionNorthAmerica', 'regionSouthAmerica', 'regionAsia', 'regionAfrica', 'regionOceania',
  'sunny', 'clear', 'partlyCloudy', 'cloudy', 'overcast', 'rain', 'thunder', 'snow', 'notifNoHikes']
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
// the visible text of a page file: comments dropped
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')

test('the region buttons, the feedback choices and the planned-hikes sentence carry no emoji, in all 13 languages', async () => {
  for (const { code: lang } of LANGUAGES) {
    const { default: pack } = await import(`./i18n/${lang}.js`)
    for (const key of SHOWN) assert.ok(pack[key] && !EMOJI.test(pack[key]), `${lang}.${key}: "${pack[key]}"`)
    assert.match(pack.notifNoHikes, /\{plan\}/, `${lang}: names the Plan a hike button`)
  }
})

test('no emoji as text in the week list, the rain warning and the airport warning: icons from the app\'s set', () => {
  assert.ok(!/>⚠ <|⚠ <\/span>|"app-only">⚠/.test(read('app/components/outlook/Tab7d.jsx')), 'the split note')
  assert.ok(!/\? '⛈' : '🌧'}<\/span>/.test(read('app/HomePage.jsx')), 'the rain warning draws its icon')
  assert.ok(!/⚠/.test(code('app/aviation/[icao]/page.js')), 'the airport warning')
})

test('the aviation pages have no em or en dash in what they show', () => {
  for (const f of ['app/aviation/page.js', 'app/aviation/[icao]/page.js']) {
    const lines = code(f).split('\n').filter(l => /[–—]/.test(l))
    assert.deepEqual(lines, [], f)
  }
})

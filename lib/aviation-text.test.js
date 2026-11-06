import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wxText } from './aviation-text.js'
import { sigWeather, tafWindshear } from './metar.js'

const shown = (lang, wx) => sigWeather(wx).map(f => wxText(lang, f.label))

test('wxText: every label sigWeather can produce comes out translated, not in English', () => {
  for (const wx of ['TS', 'FC', '+FC', 'GR', 'FZRA', 'FZDZ', 'SQ', 'VA', 'SS', 'DS', 'GS', 'PL', 'FZFG', 'BLSN', '+TSRA', 'VCTS', '+FZRA', 'VCFC']) {
    for (const text of shown('de', wx)) assert.ok(!/Thunder|Funnel|Hail|Freezing|Squall|Volcanic|storm$|pellets|Blowing|Tornado \/ water|Heavy|vicinity/i.test(text), `${wx}: ${text}`)
  }
})

test('wxText: heavy and vicinity keep their meaning', () => {
  assert.deepEqual(shown('de', 'TS'), ['Gewitter'])
  assert.deepEqual(shown('de', '+FZRA'), ['Gefrierender Regen, stark'])
  assert.deepEqual(shown('de', 'VCTS'), ['Gewitter (in der Nähe)'])
  assert.deepEqual(shown('de', '+FC'), ['Tornado / Wasserhose'])
  assert.deepEqual(shown('en', '+TSRA'), ['Thunderstorm, heavy'])
})

test('wxText: windshear keeps its numbers', () => {
  const { label } = tafWindshear({ wshearHgt: 2000, wshearDir: 270, wshearSpd: 50 })
  assert.equal(wxText('de', label), 'Windscherung 2000 ft · 270°/50 kt')
})

test('wxText: a label we do not know stays as it came', () => {
  assert.equal(wxText('de', 'Something new'), 'Something new')
})

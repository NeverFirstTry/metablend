import test from 'node:test'
import assert from 'node:assert/strict'
import { liveSources, sourceDeviation, spreadSentence, spreadSummary } from './spread.js'
import { loadLanguage, LANGUAGES } from './i18n.js'
import { tempFormatter } from './outlook/text.js'

const src = (...temps) => temps.map((temp, i) => ({ apiId: `s${i}`, temp }))
const C = tempFormatter('C')
const say = (temps, agree, lang = 'en', fmt = C) => spreadSentence(lang, src(...temps), fmt, agree)
// Lienz on 6 November: 19 sources, 3.2°, 74% agree
const LIENZ = [-1.7, -0.6, -0.3, 2.3, 2.3, 2.8, 2.8, 3, 3, 3, 3.6, 3.7, 3.9, 4.3, 4.4, 4.7, 5.1, 6.05, 7.2]

test('spreadSummary: the extremes, and the narrowest run holding two thirds of the sources', () => {
  assert.deepEqual(spreadSummary(src(-1, 2, 2.5, 3, 3.5, 4, 7)), { count: 7, min: -1, max: 7, coreLow: 2, coreHigh: 4 })
})

test('liveSources: a source that is down, or the house model, or has no reading does not count', () => {
  const live = liveSources([{ apiId: 'a', temp: 1 }, { apiId: 'b', temp: 2, down: true }, { apiId: 'c', temp: 3, synthetic: true }, { apiId: 'd', temp: null }])
  assert.deepEqual(live.map(s => s.apiId), ['a'])
})

test('high agreement (70 and up): most sources agree, with no claim about the forecast', () => {
  assert.equal(say(LIENZ, 74), 'Most of the 19 sources agree on 2–5°.')
  assert.equal(say(LIENZ, 70), 'Most of the 19 sources agree on 2–5°.')
})

test('medium agreement (45 to 69): most sources say, with no claim about the forecast', () => {
  assert.equal(say(LIENZ, 69), 'Most of the 19 sources say 2–5°.')
  assert.equal(say(LIENZ, 45), 'Most of the 19 sources say 2–5°.')
})

test('low agreement (under 45): the whole range, and expect changes', () => {
  assert.equal(say(LIENZ, 44), 'The 19 sources range from −2° to 7°, so expect changes.')
})

test('one source: nothing to compare it with, and no range', () => {
  assert.equal(say([3.2], 100), 'Only one source right now, so there’s nothing to compare it with.')
})

test('a few sources: says how few and claims nothing about how reliable the forecast is', () => {
  assert.equal(say([3, 3.6, 4.3], 94), 'Only 3 sources right now, and they agree on 3–4°.')
  assert.equal(say([3, 3.1], 99), 'Only 2 sources right now, and they agree on 3°.')
  assert.equal(say([1, 3, 9, 9.4], 40), 'Only 4 sources right now, ranging from 1° to 9°.')
})

test('all sources within 1°: they all agree, whatever the tier', () => {
  assert.equal(say([3, 3.1, 3.2, 3.3, 3.4, 3.4], 99), 'All 6 sources agree on 3°.')
  assert.equal(say([3, 3.2, 3.5, 3.6, 3.8, 4], 99), 'All 6 sources agree on 3–4°.')
})

test('below zero: a real minus sign, spaces where two signs would touch, and never −0°', () => {
  assert.equal(say([-3, -2.9, -2.8, -2.7, -1, -1.2, -9], 80), 'Most of the 7 sources agree on −3 – −1°.')
  assert.equal(say([-0.4, -0.3, -0.3, -0.2, -0.1], 99), 'All 5 sources agree on 0°.')
})

test('Fahrenheit: the numbers follow the unit', () => {
  assert.equal(say(LIENZ, 74, 'en', tempFormatter('F')), 'Most of the 19 sources agree on 36–40°.')
})

test('no live source: no sentence', () => {
  assert.equal(say([], 0), null)
  assert.equal(spreadSentence('en', undefined, C, 0), null)
})

test('never a range with the same number twice, in any tier, however the readings fall', () => {
  for (let n = 1; n <= 20; n++) {
    for (let spread = 0; spread <= 12; spread += 0.25) {
      const temps = Array.from({ length: n }, (_, i) => 2.5 + (n > 1 ? (i * spread) / (n - 1) : 0))
      for (const agree of [90, 60, 20]) {
        const text = say(temps, agree)
        const same = /(−?\d+)\s?–\s?\1°/.test(text) || /(−?\d+°) to \1/.test(text)
        assert.ok(!same, `${n} sources, ${spread}° wide, ${agree}%: ${text}`)
      }
    }
  }
})

test('every language: every case is filled in and says something of its own, none calls the forecast reliable', async () => {
  const CLAIM = /reliable|zuverlässig|fiable|affidabile|betrouwbaar|wiarygodn|spolehliv|zanesljiv|confiáv|信頼|可靠|믿을/i
  for (const { code } of LANGUAGES) {
    await loadLanguage(code)
    const cases = [[LIENZ, 74], [LIENZ, 60], [LIENZ, 30], [[3], 100], [[3, 3.6, 4.3], 94], [[1, 3, 9], 40], [[3, 3.1, 3.2, 3.3, 3.4], 99]]
    const said = new Set()
    for (const [temps, agree] of cases) {
      const text = say(temps, agree, code)
      assert.ok(text && !/[{}]/.test(text), `${code}: ${text}`)
      assert.doesNotMatch(text, CLAIM, code)
      said.add(text)
    }
    assert.equal(said.size, cases.length, `${code}: each case says something of its own`)
  }
})

test('sourceDeviation: signed whole degrees from the blend, in the unit', () => {
  assert.equal(sourceDeviation(6, 3.2, 'C').text, '+3°')
  assert.equal(sourceDeviation(-1.9, 3.2, 'C').text, '−5°')
  assert.equal(sourceDeviation(3.3, 3.2, 'C').text, '0°')
  assert.equal(sourceDeviation(3.1, 3.2, 'C').text, '0°')
  assert.equal(sourceDeviation(5.2, 3.2, 'F').text, '+4°')
})

test('sourceDeviation: a clear outlier is 5 °C or more from the blend, in either direction and in either unit', () => {
  assert.equal(sourceDeviation(8.2, 3.2, 'C').outlier, true)
  assert.equal(sourceDeviation(-1.8, 3.2, 'C').outlier, true)
  assert.equal(sourceDeviation(8.1, 3.2, 'C').outlier, false)
  assert.equal(sourceDeviation(8.1, 3.2, 'F').outlier, false)
})

test('a source whose readings a licence keeps private still counts, and the range comes from the readings shown', () => {
  const sources = [...src(...LIENZ), { apiId: 'visual-crossing', displayName: 'Visual Crossing', valuesHidden: true }]
  assert.equal(spreadSentence('en', sources, C, 74), 'Most of the 20 sources agree on 2–5°.')
})

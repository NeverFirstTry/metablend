import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chartSummary, hourLabel, summitHourLabel, sparkLabel, stormSegments, A11Y_KEYS } from './a11y-text.js'
import { tempFormatter } from './outlook/text.js'
import { t } from './i18n.js'

const C = tempFormatter('C'), F = tempFormatter('F')
const hours = [
  { t: '2026-10-03T03:00', temp: 11, rainPct: 5 },
  { t: '2026-10-03T09:00', temp: 18, rainPct: 0 },
  { t: '2026-10-03T15:00', temp: 24, rainPct: 10 },
  { t: '2026-10-03T21:00', temp: 16, rainPct: 40 },
]

test('chartSummary — low and high with their times (in any order), highest rain chance', () => {
  assert.equal(chartSummary('en', hours, C), 'Low 11° at 03:00, high 24° at 15:00, rain chance up to 40%')
  // the high can come first: the sentence must not suggest a direction
  const evening = [{ t: '2026-10-03T14:00', temp: 14, rainPct: 10 }, { t: '2026-10-03T23:00', temp: 5, rainPct: 0 }]
  assert.equal(chartSummary('en', evening, C), 'Low 5° at 23:00, high 14° at 14:00, rain chance up to 10%')
  assert.equal(chartSummary('en', [], C), '')
})

test('chartSummary — the page unit (Fahrenheit numbers), no rain part on a dry day', () => {
  assert.equal(chartSummary('en', hours, F), 'Low 52° at 03:00, high 75° at 15:00, rain chance up to 40%')
  const dry = hours.map(h => ({ ...h, rainPct: 0 }))
  assert.equal(chartSummary('en', dry, C), 'Low 11° at 03:00, high 24° at 15:00')
  assert.equal(chartSummary('en', dry.map(h => ({ ...h, rainPct: null })), C), 'Low 11° at 03:00, high 24° at 15:00')
})

test('hourLabel / summitHourLabel — one sentence per hour card', () => {
  assert.equal(hourLabel('en', hours[2], C), `15:00, ${C(24)}, rain 10%`)
  assert.equal(hourLabel('en', { ...hours[2], rainPct: null }, C), `15:00, ${C(24)}`)
  const s = summitHourLabel('en', { t: '2026-10-03T15:00', temp: -3, rainPct: 0, windKmh: 25, freezingLevel: 3100, storm: 'moderate' }, C)
  assert.equal(s, `15:00, ${C(-3)}, rain 0%, wind 25 km/h, freezing level 3100 m, storm risk moderate`)
})

test('every a11y text exists (English; parity covers the rest)', () => {
  for (const k of A11Y_KEYS) assert.notEqual(t('en', k), k, k)
})

test('sparkLabel — counts the recent reports a source was close and off', () => {
  assert.equal(sparkLabel('en', [1, -2, 0, 2, 1]), 'Last 5 reports: 3 close, 1 off')
  assert.equal(sparkLabel('en', Array.from({ length: 30 }, () => -1)), 'Last 24 reports: 0 close, 24 off')
})

test('stormSegments — 1 / 2 / 3 filled for low / moderate / high, 0 unknown', () => {
  assert.deepEqual(['low', 'moderate', 'high', null].map(stormSegments), [1, 2, 3, 0])
})

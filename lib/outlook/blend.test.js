import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blendHourly, blendDaily, band, percentile, rainProb, horizonForLeadHours, horizonForLeadDays, weightFn } from './blend.js'

const hourly = (id, pts) => ({
  id, daily: [],
  hourly: pts.map(([t, temp, extra = {}]) => ({ t, temp, pop: null, precip: null, wind: 10, code: null, ...extra })),
})
const daily = (id, pts) => ({
  id, hourly: [],
  daily: pts.map(([date, max, min, extra = {}]) => ({ date, max, min, pop: null, precip: null, wind: 20, code: null, ...extra })),
})
const NOW = '2026-09-29T10:00'

test('weightFn — learned weight, else the average of the known ones, else 1', () => {
  const w = weightFn({ a: 0.6, b: 0.2 })
  assert.equal(w('a'), 0.6)
  assert.equal(w('zzz'), 0.4)
  assert.equal(weightFn({})('x'), 1)
})

test('horizon buckets: today + tomorrow (h48), the rest of the week (d7)', () => {
  assert.deepEqual([0, 47, 48, 167].map(horizonForLeadHours), ['h48', 'h48', 'd7', 'd7'])
  assert.deepEqual([1, 2, 7].map(horizonForLeadDays), ['h48', 'd7', 'd7'])
})

test('percentile / band — p10–p90 from 6 sources, min–max below that', () => {
  assert.equal(percentile([0, 10, 11, 12, 13, 30], 0.1), 5)
  assert.deepEqual(band([30, 0, 10, 11, 12, 13]), [5, 21.5])
  assert.deepEqual(band([30, 0, 10, 11, 12]), [0, 30])
  assert.deepEqual(band([]), [null, null])
})

test('rainProb — real probability, else an amount vote, else null', () => {
  assert.equal(rainProb(80, 0, 0.1), 0.8)
  assert.equal(rainProb(null, 0.5, 0.1), 1)
  assert.equal(rainProb(null, 0.5, 1), 0)
  assert.equal(rainProb(null, null, 1), null)
})

test('blendHourly — weighted mean per hour, starting at the current local hour', () => {
  const out = blendHourly(
    [hourly('a', [['2026-09-29T09:00', 10], ['2026-09-29T10:00', 12]]), hourly('b', [['2026-09-29T10:00', 16]])],
    { h48: { a: 0.75, b: 0.25 } }, { nowLocal: NOW },
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].t, '2026-09-29T10:00')
  assert.equal(out[0].temp, 13)
  assert.deepEqual([out[0].lo, out[0].hi], [12, 16])
  assert.equal(out[0].n, 2)
})

test('blendHourly — a source without a learned weight counts like the average', () => {
  const out = blendHourly([hourly('a', [[NOW, 10]]), hourly('b', [[NOW, 20]])], { h48: { a: 0.6 } }, { nowLocal: NOW })
  assert.equal(out[0].temp, 15)
})

test('blendHourly — weights switch with lead time (48 h vs 7 days)', () => {
  const series = [
    hourly('a', [['2026-09-29T11:00', 10], ['2026-10-01T12:00', 10]]),
    hourly('b', [['2026-09-29T11:00', 20], ['2026-10-01T12:00', 20]]),
  ]
  const out = blendHourly(series, { h48: { a: 0.9, b: 0.1 }, d7: { a: 0.1, b: 0.9 } }, { nowLocal: NOW })
  assert.deepEqual(out.map(h => h.temp), [11, 19])
})

test('blendHourly — rain: probabilities as-is, amounts as votes, silence stays null', () => {
  const series = [
    hourly('a', [[NOW, 10, { pop: 80 }], ['2026-09-29T11:00', 10]]),
    hourly('b', [[NOW, 10, { precip: 0.5 }], ['2026-09-29T11:00', 10]]),
    hourly('c', [[NOW, 10, { precip: 0 }], ['2026-09-29T11:00', 10]]),
  ]
  const [h0, h1] = blendHourly(series, {}, { nowLocal: NOW })
  assert.equal(h0.rainPct, 60)
  assert.equal(h0.rainVotes, 2)
  assert.equal(h0.rainCallers, 3)
  assert.equal(h1.rainPct, null)
  assert.equal(h1.rainCallers, 0)
})

test('blendHourly — icon comes from the highest-weighted source with a weather code', () => {
  const out = blendHourly([hourly('a', [[NOW, 10, { code: 61 }]]), hourly('b', [[NOW, 10, { code: 0 }]])], { h48: { a: 0.3, b: 0.7 } }, { nowLocal: NOW })
  assert.equal(out[0].icon, '☀️')
})

test('blendHourly — caps the number of hours', () => {
  const pts = Array.from({ length: 10 }, (_, i) => [`2026-09-29T${String(10 + i).padStart(2, '0')}:00`, i])
  assert.equal(blendHourly([hourly('a', pts)], {}, { nowLocal: NOW, hours: 4 }).length, 4)
})

test('blendDaily — agreement follows the spread of the sources’ highs', () => {
  const out = blendDaily([
    daily('a', [['2026-09-29', 20, 10], ['2026-09-30', 20, 10], ['2026-10-01', 20, 10]]),
    daily('b', [['2026-09-29', 21, 11], ['2026-09-30', 23.5, 11], ['2026-10-01', 25, 11]]),
  ], {}, { todayLocal: '2026-09-29' })
  assert.deepEqual(out.map(d => [d.spread, d.agree]), [[1, 3], [3.5, 2], [5, 1]])
  assert.deepEqual(out.map(d => d.lead), [0, 1, 2])
  assert.equal(out[1].tempMax, 21.8)
  assert.deepEqual([out[2].maxLo, out[2].maxHi], [20, 25])
})

test('blendDaily — daily rain votes need ≥ 1 mm; a lone source has no spread', () => {
  const out = blendDaily([daily('a', [['2026-09-29', 20, 10, { precip: 0.5 }], ['2026-09-30', 20, 10, { precip: 2 }]])], {}, { todayLocal: '2026-09-29' })
  assert.deepEqual(out.map(d => d.rainPct), [0, 100])
  assert.equal(out[0].spread, null)
  assert.equal(out[0].agree, null)
})

test('blendDaily — skips the past, stops after a week', () => {
  const dates = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10))
  const out = blendDaily([daily('a', dates.map(d => [d, 20, 10]))], {}, { todayLocal: '2026-09-29' })
  assert.equal(out[0].date, '2026-09-29')
  assert.equal(out.length, 7)
  assert.equal(out.at(-1).lead, 6)
})

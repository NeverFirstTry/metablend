import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headlineText, headlineTone, tempFormatter, deltaFormatter, spanFormatter, dayWord, fill } from './text.js'

const today = '2026-09-29'

test('headlineText — 48 h rain window in English', () => {
  const h = { code: 'rain_window', from: '2026-09-29T15:00', to: '2026-09-29T18:00', agree: 7, total: 9, peak: { temp: 20.4, at: '2026-09-30T16:00' } }
  assert.deepEqual(headlineText('en', 'h48', h, { todayLocal: today }), {
    title: 'Rain likely 15:00–18:00 today',
    sub: '7 of 9 sources · tomorrow up to 20° at 16:00',
  })
})

test('headlineText — the translation decides the word order', () => {
  const h = { code: 'rain_window', from: '2026-09-30T06:00', to: '2026-09-30T09:00', agree: 2, total: 5, peak: null }
  assert.equal(headlineText('de', 'h48', h, { todayLocal: today }).title, 'Regen wahrscheinlich morgen 06:00–09:00')
})

test('headlineText — rain now / dry / no data', () => {
  const o = { todayLocal: today }
  assert.equal(headlineText('en', 'h48', { code: 'rain_now', until: '2026-09-29T13:00', agree: 3, total: 3, peak: null }, o).title, 'Rain now, easing around 13:00')
  assert.equal(headlineText('en', 'h48', { code: 'rain_now', until: null, agree: 3, total: 3, peak: null }, o).title, 'Rain for most of the next 48 hours')
  assert.deepEqual(headlineText('en', 'h48', { code: 'dry', peak: null }, o), { title: 'Dry for the next 48 hours', sub: null })
  assert.equal(headlineText('en', 'h48', { code: 'no_rain_data', peak: null }, o).title, 'No rain data for the next 48 hours')
})

test('headlineText — 7 days, with °F and a split warning', () => {
  const h = { code: 'best_day', date: '2026-09-30', tempMax: 22, rainPct: 5, splits: [{ date: '2026-10-03', spread: 6 }] }
  const r = headlineText('en', 'd7', h, { todayLocal: today, fmtTemp: tempFormatter('F'), fmtSpan: spanFormatter('F') })
  assert.equal(r.title, 'Best day outside: tomorrow')
  assert.equal(r.sub, '72°, 5% rain · models split by 11° on Saturday')
})

test('headlineText — 14-day trend: the shift wins over the direction', () => {
  assert.deepEqual(
    headlineText('en', 'd14', { code: 'trend', week1: 2, week2: -1, dir: 'cooler', shift: 'cooling' }, { todayLocal: today }),
    { title: 'Cooling off next week', sub: 'this week +2.0° vs normal · week 2 is a trend only' },
  )
  assert.equal(headlineText('en', 'd14', { code: 'trend', week1: 0.4, week2: 0.2, dir: 'normal', shift: null }, { todayLocal: today }).title, 'Close to normal for the season')
})

test('headlineText — null in, null out', () => {
  assert.equal(headlineText('en', 'h48', null, { todayLocal: today }), null)
})

test('formatters — °C/°F temperatures, signed deltas, unsigned spans', () => {
  assert.equal(tempFormatter('C')(20.4), '20°')
  assert.equal(tempFormatter('F')(20), '68°')
  assert.equal(tempFormatter('C')(null), '–')
  assert.equal(deltaFormatter('C')(2), '+2.0°')
  assert.equal(deltaFormatter('C')(-1.26), '−1.3°')
  assert.equal(deltaFormatter('F')(1), '+1.8°')
  assert.equal(deltaFormatter('C')(0), '±0.0°')
  assert.equal(spanFormatter('C')(5.6), '6°')
})

test('headlineTone — colours match the answer', () => {
  assert.equal(headlineTone('h48', { code: 'rain_window' }), 'rain')
  assert.equal(headlineTone('h48', { code: 'dry' }), 'ok')
  assert.equal(headlineTone('d7', { code: 'best_day' }), 'ok')
  assert.equal(headlineTone('d14', { shift: 'cooling', dir: 'cooler' }), 'rain')
  assert.equal(headlineTone('d14', { shift: null, dir: 'warmer' }), 'warn')
  assert.equal(headlineTone('d14', null), 'neutral')
})

test('dayWord / fill — today, tomorrow, weekday; placeholders', () => {
  assert.equal(dayWord('en', '2026-09-29', today), 'today')
  assert.equal(dayWord('en', '2026-09-30', today), 'tomorrow')
  assert.equal(dayWord('en', '2026-10-01', today), 'Thursday')
  assert.equal(fill('{a} of {b} ({c})', { a: 1, b: 2 }), '1 of 2 ({c})')
})

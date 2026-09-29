import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headlineText, headlineTone, tempFormatter, deltaFormatter, spanFormatter, dayWord, fill } from './text.js'

const today = '2026-09-29'

test('headlineText — today: rain window in English', () => {
  const h = { code: 'rain_window', from: '2026-09-29T15:00', to: '2026-09-29T18:00', agree: 7, total: 9, night: false, peak: { temp: 20.4, at: '2026-09-29T13:00' } }
  assert.deepEqual(headlineText('en', 'today', h, { todayLocal: today }), {
    title: 'Rain likely 15:00–18:00 today',
    sub: '7 of 9 sources · up to 20° at 13:00',
  })
})

test('headlineText — the translation decides the word order', () => {
  const h = { code: 'rain_window', from: '2026-09-30T02:00', to: '2026-09-30T05:00', agree: 2, total: 5, night: true, peak: null }
  assert.equal(headlineText('de', 'today', h, { todayLocal: today }).title, 'Regen wahrscheinlich morgen 02:00–05:00')
})

test('headlineText — today: rain now / dry / no data, by day and by night', () => {
  const o = { todayLocal: today }
  const base = { agree: 3, total: 3, peak: null }
  assert.equal(headlineText('en', 'today', { ...base, code: 'rain_now', until: '2026-09-29T13:00', night: false }, o).title, 'Rain now, easing around 13:00')
  assert.equal(headlineText('en', 'today', { ...base, code: 'rain_now', until: null, night: false }, o).title, 'Rain for the rest of today')
  assert.equal(headlineText('en', 'today', { ...base, code: 'rain_now', until: null, night: true }, o).title, 'Rain through the night')
  assert.deepEqual(headlineText('en', 'today', { code: 'dry', night: false, peak: null }, o), { title: 'Dry for the rest of today', sub: null })
  assert.equal(headlineText('en', 'today', { code: 'dry', night: true, peak: null }, o).title, 'Dry tonight')
  assert.equal(headlineText('en', 'today', { code: 'no_rain_data', night: false, peak: null }, o).title, 'No rain data for today')
})

test('headlineText — tomorrow: rain, the high and the change from today', () => {
  const o = { todayLocal: today }
  const peak = { temp: 18.4, at: '2026-09-30T16:00' }
  assert.deepEqual(
    headlineText('en', 'tomorrow', { code: 'rain_window', from: '2026-09-30T08:00', to: '2026-09-30T10:00', agree: 2, total: 3, peak, vsToday: 3.4 }, o),
    { title: 'Rain likely 08:00–10:00 tomorrow', sub: '2 of 3 sources · up to 18° at 16:00 · 3° warmer than today' },
  )
  assert.equal(headlineText('en', 'tomorrow', { code: 'dry', peak, vsToday: -2.2 }, o).sub, 'up to 18° at 16:00 · 2° cooler than today')
  assert.equal(headlineText('en', 'tomorrow', { code: 'dry', peak, vsToday: 0.4 }, o).sub, 'up to 18° at 16:00 · about as warm as today')
  assert.equal(headlineText('en', 'tomorrow', { code: 'dry', peak: null, vsToday: null }, o).title, 'Dry tomorrow')
  assert.equal(headlineText('en', 'tomorrow', { code: 'rain_all_day', agree: 3, total: 3, peak: null }, o).title, 'Rain for most of tomorrow')
  assert.equal(headlineText('en', 'tomorrow', { code: 'no_rain_data', peak: null }, o).title, 'No rain data for tomorrow')
})

test('headlineText — 7 days, with °F and a split warning', () => {
  const h = { code: 'best_day', date: '2026-09-30', tempMax: 22, rainPct: 5, splits: [{ date: '2026-10-03', spread: 6 }] }
  const r = headlineText('en', 'd7', h, { todayLocal: today, fmtTemp: tempFormatter('F'), fmtSpan: spanFormatter('F') })
  assert.equal(r.title, 'Best day outside: tomorrow')
  assert.equal(r.sub, '72°, 5% rain · models split by 11° on Saturday')
})

test('headlineText — every language has every headline', () => {
  const cases = [
    ['today', { code: 'rain_now', until: null, night: true, agree: 1, total: 2, peak: null }],
    ['today', { code: 'dry', night: false, peak: { temp: 20, at: '2026-09-29T15:00' } }],
    ['tomorrow', { code: 'rain_all_day', agree: 1, total: 2, peak: null, vsToday: -3 }],
    ['tomorrow', { code: 'no_rain_data', peak: null, vsToday: 0 }],
  ]
  for (const lang of ['en', 'de', 'fr', 'es', 'it']) {
    for (const [which, h] of cases) {
      const r = headlineText(lang, which, h, { todayLocal: today })
      assert.doesNotMatch(`${r.title} ${r.sub ?? ''}`, /\{|hl[A-Z]/, `${lang} ${which} ${h.code}`)
    }
  }
})

test('headlineText — null in, null out', () => {
  assert.equal(headlineText('en', 'today', null, { todayLocal: today }), null)
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
  assert.equal(headlineTone('today', { code: 'rain_window' }), 'rain')
  assert.equal(headlineTone('today', { code: 'dry' }), 'ok')
  assert.equal(headlineTone('tomorrow', { code: 'rain_all_day' }), 'rain')
  assert.equal(headlineTone('tomorrow', { code: 'no_rain_data' }), 'neutral')
  assert.equal(headlineTone('d7', { code: 'best_day' }), 'ok')
  assert.equal(headlineTone('d7', null), 'neutral')
})

test('dayWord / fill — today, tomorrow, weekday; placeholders', () => {
  assert.equal(dayWord('en', '2026-09-29', today), 'today')
  assert.equal(dayWord('en', '2026-09-30', today), 'tomorrow')
  assert.equal(dayWord('en', '2026-10-01', today), 'Thursday')
  assert.equal(fill('{a} of {b} ({c})', { a: 1, b: 2 }), '1 of 2 ({c})')
})

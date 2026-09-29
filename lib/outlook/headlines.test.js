import { test } from 'node:test'
import assert from 'node:assert/strict'
import { todayHours, headlineToday, headlineTomorrow, headline7, bestTimeOutside, inDaylight } from './headlines.js'
import { addHours } from '../localtime.js'

const TODAY = '2026-09-29'
const hours = (n, fn = () => ({}), start = '2026-09-29T10:00') =>
  Array.from({ length: n }, (_, i) => ({ t: addHours(start, i), temp: 15, rainPct: 10, rainVotes: 0, rainCallers: 3, windKmh: 10, icon: '⛅', ...fn(i) }))

test('todayHours — the rest of today; after 18:00 it runs through the night to 06:00', () => {
  const day = todayHours(hours(48), TODAY)
  assert.equal(day.night, false)
  assert.equal(day.hours.length, 14) // 10:00 … 23:00
  assert.equal(day.hours.at(-1).t, '2026-09-29T23:00')
  const eve = todayHours(hours(48, () => ({}), '2026-09-29T19:00'), TODAY)
  assert.equal(eve.night, true)
  assert.equal(eve.hours.at(-1).t, '2026-09-30T06:00')
  assert.deepEqual(todayHours([], TODAY), { hours: [], night: false })
})

test('headlineToday — the next rain window today with how many sources call it', () => {
  const h = hours(48, i => (i >= 5 && i <= 7 ? { rainPct: [60, 70, 55][i - 5], rainVotes: [2, 3, 2][i - 5] } : {}))
  const r = headlineToday(h, { todayLocal: TODAY })
  assert.equal(r.code, 'rain_window')
  assert.equal(r.from, '2026-09-29T15:00')
  assert.equal(r.to, '2026-09-29T18:00')
  assert.deepEqual([r.agree, r.total], [3, 3])
})

test('headlineToday — rain tomorrow is not today’s business', () => {
  const h = hours(48, i => (i === 20 ? { rainPct: 90, rainVotes: 3 } : {})) // 06:00 tomorrow
  assert.equal(headlineToday(h, { todayLocal: TODAY }).code, 'dry')
})

test('headlineToday — raining now, until it stops (or for the rest of the day)', () => {
  assert.deepEqual(
    (({ code, until }) => ({ code, until }))(headlineToday(hours(48, i => (i < 3 ? { rainPct: 80, rainVotes: 3 } : {})), { todayLocal: TODAY })),
    { code: 'rain_now', until: '2026-09-29T13:00' },
  )
  assert.equal(headlineToday(hours(48, () => ({ rainPct: 90 })), { todayLocal: TODAY }).until, null)
})

test('headlineToday — dry vs no rain data; the peak only by day', () => {
  const r = headlineToday(hours(48, i => (i === 4 ? { temp: 21 } : {})), { todayLocal: TODAY })
  assert.equal(r.code, 'dry')
  assert.deepEqual(r.peak, { temp: 21, at: '2026-09-29T14:00' })
  assert.equal(headlineToday(hours(48, () => ({ rainPct: null, rainCallers: 0 })), { todayLocal: TODAY }).code, 'no_rain_data')
  const night = headlineToday(hours(24, () => ({}), '2026-09-29T20:00'), { todayLocal: TODAY })
  assert.equal(night.night, true)
  assert.equal(night.peak, null)
  assert.equal(headlineToday([], { todayLocal: TODAY }), null)
})

const DAYS = [
  { date: '2026-09-29', tempMax: 15, tempMin: 8 },
  { date: '2026-09-30', tempMax: 18.4, tempMin: 9 },
]

test('headlineTomorrow — rain window, the high, and how it compares', () => {
  const h = hours(48, i => ({
    ...(i === 30 ? { temp: 18.4 } : {}), // 16:00 tomorrow
    ...(i >= 22 && i <= 23 ? { rainPct: 70, rainVotes: 2 } : {}), // 08:00–10:00 tomorrow
  }))
  const r = headlineTomorrow(h, DAYS, [{ date: '2026-09-30', max: 16, min: 7 }], { todayLocal: TODAY })
  assert.equal(r.code, 'rain_window')
  assert.equal(r.from, '2026-09-30T08:00')
  assert.equal(r.to, '2026-09-30T10:00')
  assert.deepEqual([r.agree, r.total], [2, 3])
  assert.deepEqual(r.peak, { temp: 18.4, at: '2026-09-30T16:00' })
  assert.equal(r.vsToday, 3.4)
  assert.equal(r.vsNormal, 2.4)
})

test('headlineTomorrow — rain before 06:00 belongs to tonight, not to tomorrow', () => {
  const tmr = hours(24, i => (i === 0 || i === 14 ? { rainPct: 80, rainVotes: 3 } : {}), '2026-09-30T00:00')
  const r = headlineTomorrow(tmr, DAYS, [], { todayLocal: TODAY })
  assert.equal(r.code, 'rain_window')
  assert.equal(r.from, '2026-09-30T14:00')
  assert.equal(headlineTomorrow(hours(24, i => (i < 5 ? { rainPct: 80 } : {}), '2026-09-30T00:00'), DAYS, [], { todayLocal: TODAY }).code, 'dry')
  // wet from 06:00 to midnight is all day, whatever the night does
  assert.equal(headlineTomorrow(hours(24, i => (i >= 6 ? { rainPct: 80 } : {}), '2026-09-30T00:00'), DAYS, [], { todayLocal: TODAY }).code, 'rain_all_day')
})

test('headlineTomorrow — all-day rain, dry, no data, nothing to say', () => {
  const tmr = (fn) => hours(24, fn, '2026-09-30T00:00')
  assert.equal(headlineTomorrow(tmr(() => ({ rainPct: 80 })), DAYS, [], { todayLocal: TODAY }).code, 'rain_all_day')
  const dry = headlineTomorrow(tmr(), DAYS, [], { todayLocal: TODAY })
  assert.equal(dry.code, 'dry')
  assert.equal(dry.vsNormal, null)
  assert.equal(headlineTomorrow(tmr(() => ({ rainPct: null })), DAYS, [], { todayLocal: TODAY }).code, 'no_rain_data')
  assert.equal(headlineTomorrow(hours(5), DAYS, [], { todayLocal: TODAY }), null)
})

test('inDaylight — sunrise to 30 min before sunset; 07–21 without sun times', () => {
  const sun = { sunrise: '06:58', sunset: '18:50' }
  assert.equal(inDaylight('06:00', sun), false)
  assert.equal(inDaylight('07:00', sun), true)
  assert.equal(inDaylight('18:00', sun), true)
  assert.equal(inDaylight('19:00', sun), false)
  assert.equal(inDaylight('21:00', null), true)
  assert.equal(inDaylight('22:00', { sunrise: null, sunset: null }), false)
})

test('bestTimeOutside — daytime only, rain weighs most', () => {
  const h = hours(24, i => ({ temp: 20, rainPct: i === 3 ? 0 : 40 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h).t, '2026-09-29T07:00') // 03:00 is dry but at night
  const h2 = hours(24, i => ({ temp: 20, rainPct: i === 14 ? 0 : 40 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h2).t, '2026-09-29T14:00')
  assert.equal(bestTimeOutside([]), null)
})

test('bestTimeOutside — a mild afternoon in a light breeze beats a cold calm morning', () => {
  const h = hours(24, i => ({ temp: i < 12 ? 13 : 22, rainPct: 0, windKmh: i < 12 ? 2 : 12 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h).t.slice(11, 13), '12')
  // a real gale still counts
  const gale = hours(24, i => ({ temp: i < 12 ? 13 : 22, rainPct: 0, windKmh: i < 12 ? 2 : 50 }), '2026-09-29T00:00')
  assert.ok(Number(bestTimeOutside(gale).t.slice(11, 13)) < 12)
})

test('bestTimeOutside — only in daylight: a calm evening after sunset never wins', () => {
  // everything equal except the wind, which drops after dark
  const h = hours(24, i => ({ temp: 20, rainPct: 0, windKmh: i >= 19 ? 0 : 30 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h).t, '2026-09-29T19:00') // no sun times: 07–21 fallback
  const sun = { sunrise: '06:58', sunset: '18:50' }
  assert.equal(bestTimeOutside(h, sun).t, '2026-09-29T07:00')
  assert.ok(Number(bestTimeOutside(h, sun).t.slice(11, 13)) <= 18) // 18:00 still has 50 min of light
  assert.equal(bestTimeOutside(hours(3, () => ({}), '2026-09-29T20:00'), sun), null) // evening: nothing left today
})

test('bestTimeOutside — when every hour is wet there is no best time', () => {
  assert.equal(bestTimeOutside(hours(12, () => ({ rainPct: 85 }), '2026-09-29T08:00')), null)
})

test('headline7 — best day by rain, wind and comfort; splits over 4°', () => {
  const days = [
    { date: '2026-09-29', tempMax: 18, rainPct: 70, windKmh: 10, spread: 1 },
    { date: '2026-09-30', tempMax: 22, rainPct: 5, windKmh: 10, spread: 2 },
    { date: '2026-10-01', tempMax: 12, rainPct: 5, windKmh: 30, spread: 6 },
  ]
  assert.deepEqual(headline7(days), { code: 'best_day', date: '2026-09-30', tempMax: 22, rainPct: 5, splits: [{ date: '2026-10-01', spread: 6 }] })
  assert.equal(headline7(days.map(d => ({ ...d, rainPct: 80 }))).code, 'no_good_day')
  assert.equal(headline7([]), null)
})

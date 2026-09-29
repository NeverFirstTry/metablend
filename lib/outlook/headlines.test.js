import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headline48, headline7, headline14, bestTimeOutside } from './headlines.js'
import { addHours } from '../localtime.js'

const TODAY = '2026-09-29'
const hours = (n, fn = () => ({}), start = '2026-09-29T10:00') =>
  Array.from({ length: n }, (_, i) => ({ t: addHours(start, i), temp: 15, rainPct: 10, rainVotes: 0, rainCallers: 3, windKmh: 10, icon: '⛅', ...fn(i) }))

test('headline48 — the next rain window with how many sources call it', () => {
  const h = hours(48, i => (i >= 5 && i <= 7 ? { rainPct: [60, 70, 55][i - 5], rainVotes: [2, 3, 2][i - 5] } : {}))
  const r = headline48(h, { todayLocal: TODAY })
  assert.equal(r.code, 'rain_window')
  assert.equal(r.from, '2026-09-29T15:00')
  assert.equal(r.to, '2026-09-29T18:00')
  assert.deepEqual([r.agree, r.total], [3, 3])
})

test('headline48 — raining now, until it stops (or all 48 h)', () => {
  assert.deepEqual(
    (({ code, until }) => ({ code, until }))(headline48(hours(48, i => (i < 3 ? { rainPct: 80, rainVotes: 3 } : {})), { todayLocal: TODAY })),
    { code: 'rain_now', until: '2026-09-29T13:00' },
  )
  assert.equal(headline48(hours(48, () => ({ rainPct: 90 })), { todayLocal: TODAY }).until, null)
})

test('headline48 — dry vs no rain data at all', () => {
  assert.equal(headline48(hours(48), { todayLocal: TODAY }).code, 'dry')
  assert.equal(headline48(hours(48, () => ({ rainPct: null, rainCallers: 0 })), { todayLocal: TODAY }).code, 'no_rain_data')
  assert.equal(headline48([], { todayLocal: TODAY }), null)
})

test('headline48 — peak is tomorrow’s warmest hour', () => {
  const h = hours(48, i => (i === 30 ? { temp: 20 } : {}))
  assert.deepEqual(headline48(h, { todayLocal: TODAY }).peak, { temp: 20, at: '2026-09-30T16:00' })
})

test('bestTimeOutside — daytime only, rain weighs most', () => {
  const h = hours(24, i => ({ temp: 20, rainPct: i === 3 ? 0 : 40 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h).t, '2026-09-29T07:00') // 03:00 is dry but at night
  const h2 = hours(24, i => ({ temp: 20, rainPct: i === 14 ? 0 : 40 }), '2026-09-29T00:00')
  assert.equal(bestTimeOutside(h2).t, '2026-09-29T14:00')
  assert.equal(bestTimeOutside([]), null)
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

test('headline14 — direction from week 2 vs normal, shift when the weeks differ', () => {
  const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10))
  const normals = dates.map(date => ({ date, max: 15, min: 5 }))
  const cooling = dates.map((date, i) => ({ date, tempMax: i < 7 ? 17 : 14 }))
  assert.deepEqual(headline14(cooling, normals), { code: 'trend', week1: 2, week2: -1, dir: 'cooler', shift: 'cooling' })
  assert.equal(headline14(dates.map(date => ({ date, tempMax: 15.5 })), normals).dir, 'normal')
  assert.equal(headline14(cooling, []), null)
})

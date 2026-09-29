import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayOfYear, indexArchive, normalsFor, rainyDaysNormal, anomalies } from './climate.js'

const row = (date, max, min, precip = 0) => ({ date, year: date.slice(0, 4), doy: dayOfYear(date.slice(5)), max, min, precip })

test('dayOfYear — non-leap calendar, Feb 29 shares Feb 28', () => {
  assert.equal(dayOfYear('01-01'), 1)
  assert.equal(dayOfYear('03-01'), 60)
  assert.equal(dayOfYear('12-31'), 365)
  assert.equal(dayOfYear('02-29'), 59)
})

test('normalsFor — ±7-day window wraps over New Year', () => {
  const rows = [row('2020-12-28', 2, -2), row('2021-01-03', 4, 0), row('2021-06-01', 25, 15)]
  assert.deepEqual(normalsFor(rows, ['2026-01-01']), [{ date: '2026-01-01', max: 3, min: -1 }])
  assert.deepEqual(normalsFor(rows, ['2026-03-15']), [{ date: '2026-03-15', max: null, min: null }])
})

test('rainyDaysNormal — wet days per average year on the same calendar days', () => {
  const rows = [
    row('2020-10-01', 15, 8, 3), row('2020-10-02', 15, 8, 5),
    row('2021-10-01', 15, 8, 0.2), row('2021-10-02', 15, 8, 1), row('2021-10-03', 15, 8, 9),
  ]
  assert.equal(rainyDaysNormal(rows, ['2026-10-01', '2026-10-02']), 2) // (2 + 1) / 2 → 2
})

test('anomalies — the week’s highs vs normal', () => {
  const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10))
  const normals = dates.map(date => ({ date, max: 15, min: 5 }))
  const days = dates.map((date, i) => ({ date, tempMax: i < 4 ? 17 : 16 }))
  assert.deepEqual(anomalies(days, normals), { week1: 1.6 })
  assert.deepEqual(anomalies(days, []), { week1: null })
})

test('indexArchive — skips days without temperatures; garbage → null', () => {
  const rows = indexArchive({ daily: { time: ['2020-01-01', '2020-01-02'], temperature_2m_max: [3, null], temperature_2m_min: [-1, 0], precipitation_sum: [0.4, 2] } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].doy, 1)
  assert.equal(indexArchive(null), null)
})

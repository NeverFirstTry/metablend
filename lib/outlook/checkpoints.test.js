import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hourlyCheckpoints, dailyCheckpoints, hourlySlot, dailySlot } from './checkpoints.js'

const pt = (t, extra = {}) => ({ t, temp: 10, pop: 30, precip: null, wind: 5, code: null, ...extra })

test('hourlyCheckpoints — +6/12/24/48 h in UTC, looked up in city-local time', () => {
  // UTC+2; issued 13:20Z → next full hour 14:00Z → +6 h = 20:00Z = 22:00 local
  const s = { id: 'x', daily: [], hourly: [pt('2026-09-29T22:00'), pt('2026-09-30T04:00'), pt('2026-09-30T16:00', { pop: null, precip: 0.2 }), pt('2026-10-01T16:00', { pop: null })] }
  assert.deepEqual(hourlyCheckpoints(s, { issuedAtMs: Date.parse('2026-09-29T13:20:00Z'), utcOffsetSec: 7200 }), [
    { key: 'h6', t: '2026-09-29T20:00:00.000Z', lead: 6, temp: 10, rain: 0.3 },
    { key: 'h12', t: '2026-09-30T02:00:00.000Z', lead: 12, temp: 10, rain: 0.3 },
    { key: 'h24', t: '2026-09-30T14:00:00.000Z', lead: 24, temp: 10, rain: 1 },
    { key: 'h48', t: '2026-10-01T14:00:00.000Z', lead: 48, temp: 10, rain: null },
  ])
})

test('hourlyCheckpoints — half-hour offsets (India) line up too', () => {
  const s = { id: 'x', daily: [], hourly: [pt('2026-09-29T19:30')] }
  // issued 07:10Z → 08:00Z + 6 h = 14:00Z = 19:30 IST
  assert.deepEqual(hourlyCheckpoints(s, { issuedAtMs: Date.parse('2026-09-29T07:10:00Z'), utcOffsetSec: 19800 }).map(c => c.key), ['h6'])
})

test('dailyCheckpoints — leads 1..7 from the city-local date', () => {
  const d = (date, max) => ({ date, max, min: max - 8, pop: null, precip: 2, wind: 10, code: null })
  const s = { id: 'x', hourly: [], daily: [d('2026-09-29', 20), d('2026-09-30', 21), d('2026-10-06', 15), d('2026-10-07', 14)] }
  assert.deepEqual(dailyCheckpoints(s, { todayLocal: '2026-09-29' }).map(c => [c.key, c.date, c.max, c.rain]), [
    ['d1', '2026-09-30', 21, 1],
    ['d7', '2026-10-06', 15, 1],
  ])
})

test('slots — 6-hour UTC slots and yyyymmdd days', () => {
  assert.equal(hourlySlot(Date.parse('2026-09-29T05:59:00Z')), hourlySlot(Date.parse('2026-09-29T00:00:00Z')))
  assert.notEqual(hourlySlot(Date.parse('2026-09-29T06:00:00Z')), hourlySlot(Date.parse('2026-09-29T05:59:00Z')))
  assert.equal(dailySlot('2026-09-29'), 20260929)
})

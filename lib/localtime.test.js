import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localHourAt, isNightAt, localDateForLon, localMidnightUtc, formatCalendarDate } from './localtime.js'

// Render fn() as if the viewer's device sat in the given IANA timezone.
function inTimeZone(tz, fn) {
  const saved = process.env.TZ
  process.env.TZ = tz
  try {
    return fn()
  } finally {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  }
}

test('localHourAt — solar hour from longitude, wrapped into 0–24', () => {
  const noonUtc = new Date('2026-07-06T12:00:00Z')
  assert.equal(localHourAt(0, noonUtc), 12)
  assert.equal(localHourAt(150, noonUtc), 22)   // +10 h
  assert.equal(localHourAt(-120, noonUtc), 4)   // −8 h
  assert.equal(localHourAt(-180, new Date('2026-07-06T02:00:00Z')), 14) // wraps below 0
  assert.equal(localHourAt(null, noonUtc), 12)  // unknown lon → UTC
})

test('isNightAt — 21:00–06:00 city-local', () => {
  const noonUtc = new Date('2026-07-06T12:00:00Z')
  assert.equal(isNightAt(0, noonUtc), false)
  assert.equal(isNightAt(150, noonUtc), true)   // 22:00 local
  assert.equal(isNightAt(-120, noonUtc), true)  // 04:00 local
  assert.equal(isNightAt(-75, noonUtc), false)  // 07:00 local
})

test('localDateForLon — city-local calendar day, not the server day', () => {
  const utc23 = new Date('2026-07-06T23:00:00Z').getTime()
  assert.equal(localDateForLon(139.65, utc23), '2026-07-07') // Tokyo is already tomorrow
  assert.equal(localDateForLon(0, utc23), '2026-07-06')
  const utc01 = new Date('2026-07-06T01:00:00Z').getTime()
  assert.equal(localDateForLon(-118.24, utc01), '2026-07-05') // LA is still yesterday
})

test('localMidnightUtc — start of the CITY\'s day, not the server\'s', () => {
  // Tokyo-ish (+10 h) at 20:00 UTC: 06:00 local on the 7th → day began 14:00 UTC on the 6th
  assert.equal(
    localMidnightUtc(150, new Date('2026-07-06T20:00:00Z').getTime()).toISOString(),
    '2026-07-06T14:00:00.000Z',
  )
  // LA-ish (−8 h) at 05:00 UTC: 21:00 local on the 5th → day began 08:00 UTC on the 5th
  assert.equal(
    localMidnightUtc(-120, new Date('2026-07-06T05:00:00Z').getTime()).toISOString(),
    '2026-07-05T08:00:00.000Z',
  )
})

test('formatCalendarDate — a YYYY-MM-DD date keeps its weekday in every viewer timezone', () => {
  // 2026-09-30 is a Wednesday. Parsed naively it is UTC midnight, which
  // renders as Tuesday anywhere west of UTC.
  for (const tz of ['America/New_York', 'America/Los_Angeles', 'Europe/Vienna', 'Pacific/Auckland']) {
    const label = inTimeZone(tz, () => formatCalendarDate('2026-09-30', 'en', { weekday: 'short' }))
    assert.equal(label, 'Wed', tz)
  }
})

test('formatCalendarDate — day/month/year options keep the same calendar day', () => {
  const label = inTimeZone('America/Los_Angeles', () =>
    formatCalendarDate('2019-07-01', 'en', { day: '2-digit', month: 'short', year: '2-digit' }))
  assert.equal(label, 'Jul 01, 19')
})

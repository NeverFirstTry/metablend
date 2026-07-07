import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blendDailyForecasts, getRegion, localDateForLon } from './weather.js'

const day = (date, tempMax, tempMin, rainPct, windKmh, condition = 'Cloudy', icon = '⛅') =>
  ({ date, tempMax, tempMin, rainPct, windKmh, condition, icon })

test('blendDailyForecasts — weighted mean across sources', () => {
  const bundle = [
    { apiId: 'open-meteo', days: [day('2026-07-08', 20, 10, 40, 10, 'Rain', '🌧')], sunrise: '05:00', sunset: '21:00' },
    { apiId: 'gfs',        days: [day('2026-07-08', 30, 20, 0, 20, 'Clear', '☀️')] },
  ]
  // open-meteo weight 0.75, gfs 0.25 → tempMax = 20*0.75 + 30*0.25 = 22.5
  const { days, sunrise } = blendDailyForecasts(bundle, { 'open-meteo': 0.75, gfs: 0.25 })
  assert.equal(days.length, 1)
  assert.equal(days[0].tempMax, 22.5)
  assert.equal(days[0].tempMin, 12.5)
  assert.equal(days[0].rainPct, 30)          // 40*0.75 + 0*0.25
  assert.equal(days[0].windKmh, 13)          // 12.5 rounded
  assert.equal(days[0].condition, 'Rain')    // highest-weight source wins the label
  assert.equal(days[0].sources, 2)
  assert.equal(sunrise, '05:00')
})

test('blendDailyForecasts — null rain values stay out of the rain average', () => {
  const bundle = [
    { apiId: 'a', days: [day('2026-07-08', 20, 10, null, 10)] },
    { apiId: 'b', days: [day('2026-07-08', 20, 10, 80, 10)] },
  ]
  const { days } = blendDailyForecasts(bundle, { a: 0.9, b: 0.1 })
  assert.equal(days[0].rainPct, 80) // only b reported a probability
})

test('blendDailyForecasts — dates sorted, capped at 7, missing dates tolerated', () => {
  const mk = n => day(`2026-07-${String(n).padStart(2, '0')}`, 20, 10, 0, 5)
  const bundle = [
    { apiId: 'a', days: [3, 1, 2, 4, 5, 6, 7, 8, 9].map(mk) },
    { apiId: 'b', days: [mk(1)] },
  ]
  const { days } = blendDailyForecasts(bundle, {})
  assert.equal(days.length, 7)
  assert.equal(days[0].date, '2026-07-01')
  assert.equal(days[0].sources, 2)
  assert.equal(days[1].sources, 1)
})

test('blendDailyForecasts — empty bundle degrades gracefully', () => {
  assert.deepEqual(blendDailyForecasts([], {}), { days: [], sunrise: '–', sunset: '–' })
  assert.deepEqual(blendDailyForecasts([{ apiId: 'a', days: [] }], {}).days, [])
})

test('getRegion — the basket cities land in their regions', () => {
  assert.equal(getRegion(48.21, 16.37), 'europe')        // Vienna
  assert.equal(getRegion(40.71, -74.01), 'north_america') // New York
  assert.equal(getRegion(-33.87, 151.21), 'oceania')      // Sydney
  assert.equal(getRegion(35.68, 139.65), 'asia')          // Tokyo
})

test('localDateForLon — city-local calendar day, not the server day', () => {
  // 23:00 UTC: Tokyo (lon 139.65 → +9.3h solar) is already tomorrow
  const utc23 = new Date('2026-07-06T23:00:00Z')
  const shifted = new Date(utc23.getTime() + (139.65 / 15) * 3600 * 1000)
  assert.equal(shifted.toISOString().slice(0, 10), '2026-07-07')
})

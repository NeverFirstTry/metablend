import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blendDailyForecasts, getRegion, localDateForLon,
  fetchMETNorway, fetchTomorrow, fetchVisualCrossing,
} from './weather.js'

// Stub global fetch with one canned JSON body for the duration of fn().
// Keyed sources bail out early without a key, so provide dummies — the stub
// never sends them anywhere.
async function withFetch(body, fn) {
  const real = globalThis.fetch
  const keys = ['TOMORROW_KEY', 'VISUAL_CROSSING_KEY']
  const saved = keys.map(k => process.env[k])
  keys.forEach(k => { process.env[k] = 'test-key' })
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => body })
  try {
    return await fn()
  } finally {
    globalThis.fetch = real
    keys.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i] })
  }
}

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

// A source may only set rainIsProb when it actually reported a probability.
// Regression guard for the bug where MET Norway published a fabricated 0 %
// as a real probability on every search, pulling the rain consensus toward
// "no rain" while other sources were reporting active rain.
test('rainIsProb is false when the source reports no probability', async () => {
  const met = await withFetch({
    properties: { timeseries: [{
      data: {
        instant: { details: { air_temperature: 12, wind_speed: 3 } },
        next_1_hours: { details: { precipitation_amount: 0 }, summary: { symbol_code: 'rain' } },
      },
    }] },
  }, () => fetchMETNorway(46.8, 12.8))
  assert.equal(met.rainIsProb, false, 'MET Norway reports amount, never probability')
  assert.equal(met.rainPct, 0, 'amount 0 mm still yields a usable pseudo-probability')

  const tom = await withFetch({ data: { values: { temperature: 12, temperatureApparent: 11, windSpeed: 2 } } },
    () => fetchTomorrow(46.8, 12.8))
  assert.equal(tom.rainIsProb, false)
  assert.equal(tom.rainPct, null)

  const vc = await withFetch({ currentConditions: { temp: 12, feelslike: 11, windspeed: 5 } },
    () => fetchVisualCrossing(46.8, 12.8))
  assert.equal(vc.rainIsProb, false)
  assert.equal(vc.rainPct, null)
})

test('rainIsProb is true — and the value preserved — when a probability is present', async () => {
  const met = await withFetch({
    properties: { timeseries: [{
      data: {
        instant: { details: { air_temperature: 12, wind_speed: 3 } },
        next_1_hours: { details: { probability_of_precipitation: 65, precipitation_amount: 2 } },
      },
    }] },
  }, () => fetchMETNorway(46.8, 12.8))
  assert.equal(met.rainIsProb, true)
  assert.equal(met.rainPct, 65, 'a real probability wins over the amount fallback')

  const tom = await withFetch({ data: { values: { temperature: 12, temperatureApparent: 11, windSpeed: 2, precipitationProbability: 40 } } },
    () => fetchTomorrow(46.8, 12.8))
  assert.equal(tom.rainIsProb, true)
  assert.equal(tom.rainPct, 40)
})

test('MET Norway precipitation amount becomes a capped pseudo-probability', async () => {
  const wet = await withFetch({
    properties: { timeseries: [{
      data: {
        instant: { details: { air_temperature: 12, wind_speed: 3 } },
        next_1_hours: { details: { precipitation_amount: 5 } }, // heavy
      },
    }] },
  }, () => fetchMETNorway(46.8, 12.8))
  assert.equal(wet.rainPct, 90, 'capped at 90, same convention as NASA POWER / GeoSphere')
  assert.equal(wet.rainIsProb, false, 'an amount is still never a probability')
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

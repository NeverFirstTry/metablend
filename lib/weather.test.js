import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getRegion,
  fetchMETNorway, fetchTomorrow, fetchVisualCrossing, pickPlace,
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

// result lists as Open-Meteo's geocoder returned them (2026-10-02)
const P = (name, country_code, population = 0) => ({ name, country_code, population })
test('pickPlace — a short query that only hit an airport code goes to the town of that name', () => {
  const kos = [P('Sihanoukville', 'KH', 73036), P('Kos', 'GR', 19244), P('Kos', 'BG'), P('Koš', 'SK', 1005), P('Kos', 'PK')]
  assert.equal(pickPlace(kos, 'Kos').country_code, 'GR')
  assert.equal(pickPlace(kos, ' kos ').country_code, 'GR')
})

test('pickPlace — the top match stays when it starts with the query, is the query, or the query is long', () => {
  const vie = [P('Vienna', 'AT', 1691468), P('Viet Tri', 'VN', 415280), P('Vié', 'AO')]
  assert.equal(pickPlace(vie, 'vie').name, 'Vienna') // a prefix: typing on towards Vienna
  const gra = [P('Graz', 'AT', 303270), P('Gamarra', 'CO', 12444), P('Gra', 'CI')]
  assert.equal(pickPlace(gra, 'gra').name, 'Graz')
  const wien = [P('Wien', 'AT', 1691468), P('Wien', 'US')]
  assert.equal(pickPlace(wien, 'Wien').country_code, 'AT')
  const munich = [P('Munich', 'DE', 1260391), P('München', 'DE', 300)]
  assert.equal(pickPlace(munich, 'München').name, 'Munich') // a native name: not a code match
  const lonely = [P('Sihanoukville', 'KH', 73036), P('Kos', 'BG')]
  assert.equal(pickPlace(lonely, 'kos').name, 'Sihanoukville') // no populated town of that name
  assert.equal(pickPlace([], 'kos'), undefined)
})

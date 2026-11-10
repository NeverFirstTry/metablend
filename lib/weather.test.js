import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  getRegion,
  fetchMETNorway, fetchVisualCrossing, pickPlace, decodeWeatherCode,
  parseOpenMeteoModels, modelSource, MORE_MODELS, fetchPirateWeather, fetchGeoSphere, geoSphereUrl, fetchWeatherAPI,
  fetchOpenMeteoModels, missingModels, GLOBAL_MODELS, fetchOpenMeteoExtras, fetchOpenMeteoDetails, fetchYesterdayTemp,
  fetchECMWF, fetchGFS, fetchICON, fetchMeteoFrance, tfetch, fetchNWS, fetchBrightSky,
} from './weather.js'
import { callWeight } from './open-meteo.js'
import fs from 'node:fs'

// Stub global fetch with one canned JSON body for the duration of fn().
// Keyed sources bail out early without a key, so provide dummies — the stub
// never sends them anywhere.
async function withFetch(body, fn) {
  const real = globalThis.fetch
  const keys = ['VISUAL_CROSSING_KEY']
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
  assert.equal(wet.rainPct, 90, 'capped at 90, same convention as GeoSphere')
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

test('pickPlace — with where the search came from: the nearest town of that name, not the biggest (Vienna, Virginia; Portland, Maine)', () => {
  const at = (name, admin1, latitude, longitude, population = 0) => ({ name, admin1, latitude, longitude, population })
  const vienna = [at('Vienna', 'Vienna', 48.21, 16.37, 1691468), at('Vienna', 'Georgia', 32.09, -83.8, 3700), at('Vienna Woods', 'Virginia', 38.89, -77.25), at('Vienna', 'Virginia', 38.9, -77.27, 16522)]
  assert.equal(pickPlace(vienna, 'Vienna', { lat: 38.9, lon: -77.3 }).admin1, 'Virginia')
  assert.equal(pickPlace(vienna, 'Vienna', { lat: 38.9, lon: -77.3 }).name, 'Vienna') // the town of that name, though Vienna Woods is as close
  assert.equal(pickPlace(vienna, 'Vienna', { lat: -33.9, lon: 151.2 }).admin1, 'Vienna') // none near: as without
  assert.equal(pickPlace(vienna, 'Vienna').admin1, 'Vienna')
})


const omMore = JSON.parse(fs.readFileSync(new URL('./__fixtures__/om-more-lienz.json', import.meta.url), 'utf8'))

test('parseOpenMeteoModels — Lienz: the global models and the Alpine / European regional ones, not the US-only NBM', () => {
  const list = parseOpenMeteoModels(omMore)
  assert.deepEqual(list.map(r => r.apiId), ['ukmo', 'gem', 'jma', 'cma', 'aifs', 'meteoswiss', 'italiameteo', 'knmi', 'dmi'])
  for (const r of list) {
    assert.equal(typeof r.temp, 'number', r.apiId)
    assert.equal(typeof r.feelsLike, 'number', r.apiId)
    assert.equal(typeof r.windKmh, 'number', r.apiId)
    assert.equal(typeof r.condition, 'string', r.apiId)
    assert.equal(r.rainIsProb, r.rainPct != null, r.apiId)
    assert.ok(r.displayName, r.apiId)
  }
})

test('parseOpenMeteoModels — an error or an odd answer gives no sources', () => {
  assert.deepEqual(parseOpenMeteoModels(null), [])
  assert.deepEqual(parseOpenMeteoModels({ error: true, reason: 'No data is available for this location' }), [])
  assert.deepEqual(parseOpenMeteoModels({ hourly: { time: ['2026-10-19T22:00'] } }), [])
})

test('modelSource — the extra models share one Open-Meteo request per spot', async () => {
  const real = globalThis.fetch
  let calls = 0
  globalThis.fetch = async url => { calls++; assert.ok(String(url).includes(MORE_MODELS.map(m => m[1]).join(','))); return new Response(JSON.stringify(omMore)) }
  try {
    const [ukmo, knmi, nbm] = await Promise.all([modelSource('ukmo')(46.0001, 12.0001), modelSource('knmi')(46.0001, 12.0001), modelSource('nbm')(46.0001, 12.0001)])
    assert.equal(calls, 1)
    assert.equal(ukmo.apiId, 'ukmo')
    assert.equal(knmi.apiId, 'knmi')
    assert.equal(nbm, null) // no data here: the source just doesn't show
  } finally {
    globalThis.fetch = real
  }
})

test('fetchGeoSphere — INCA-v2 at the nearest grid cell, the newest hour that has a temperature', async () => {
  const url = geoSphereUrl(46.8295, 12.7687, Date.parse('2026-11-06T12:40:00Z'))
  assert.match(url, /\/inca-v2-1h-1km\?/)
  assert.match(url, /start=2026-11-06T09:00&end=2026-11-06T12:00&lat_lon=46\.8295,12\.7687$/)
  const body = { features: [{ properties: { parameters: {
    '2t': { data: [1.04, 2.26, null] },
    tp: { data: [0, 0.5, null] },
    '10u': { data: [1, 3, null] },
    '10v': { data: [1, 4, null] },
  } } }] }
  assert.deepEqual(await withFetch(body, () => fetchGeoSphere(46.83, 12.77)), {
    apiId: 'geosphere', displayName: 'GeoSphere Austria', temp: 2.3, feelsLike: 2.3, rainPct: 25, windKmh: 18, condition: 'Drizzle',
  })
})

test('fetchGeoSphere — outside its box it was not asked; inside, no data is no answer', async () => {
  assert.equal(await fetchGeoSphere(52.52, 13.4), undefined)
  assert.equal(await withFetch({ features: [] }, () => fetchGeoSphere(46.83, 12.77)), null)
  assert.equal(await withFetch({ features: [{ properties: { parameters: { '2t': { data: [null, null] } } } }] }, () => fetchGeoSphere(46.83, 12.77)), null)
})

test('fetchPirateWeather — off without a key; with one, current conditions in °C, km/h and a real probability', async () => {
  const saved = process.env.PIRATE_WEATHER_KEY
  delete process.env.PIRATE_WEATHER_KEY
  try {
    assert.equal(await fetchPirateWeather(46.8, 12.8), undefined) // not asked, so no failure for Uptime
    process.env.PIRATE_WEATHER_KEY = 'test-key'
    const r = await withFetch({ currently: { temperature: 11.4, apparentTemperature: 10.2, precipProbability: 0.35, windSpeed: 2.5, summary: 'Light Rain' } }, () => fetchPirateWeather(46.8, 12.8))
    assert.deepEqual(r, { apiId: 'pirateweather', displayName: 'Pirate Weather', temp: 11.4, feelsLike: 10.2, rainPct: 35, rainIsProb: true, windKmh: 9, condition: 'Light Rain' })
    assert.equal(await withFetch({ error: 'bad key' }, () => fetchPirateWeather(46.8, 12.8)), null)
  } finally {
    if (saved === undefined) delete process.env.PIRATE_WEATHER_KEY; else process.env.PIRATE_WEATHER_KEY = saved
  }
})

test('decodeWeatherCode — no code is "Unknown", not partly cloudy (null compares as 0)', () => {
  assert.equal(decodeWeatherCode(null), 'Unknown')
  assert.equal(decodeWeatherCode(undefined), 'Unknown')
  assert.equal(decodeWeatherCode(0), 'Clear')
  assert.equal(decodeWeatherCode(2), 'Partly cloudy')
})

test('fetchMETNorway — coordinates go out with at most four decimals, as MET Norway\'s terms ask', async () => {
  const real = globalThis.fetch
  let asked
  globalThis.fetch = async url => { asked = String(url); return new Response(JSON.stringify({ properties: { timeseries: [] } })) }
  try { await fetchMETNorway(48.20849, 16.37208) } finally { globalThis.fetch = real }
  assert.match(asked, /lat=48\.2085&lon=16\.3721$/)
})

// WeatherAPI's data processing agreement (clause 9.6): an EU-only API hostname on request. WEATHERAPI_HOST
// switches to it without a code change; api.weatherapi.com stays the default.
test('fetchWeatherAPI — asks the host in WEATHERAPI_HOST, api.weatherapi.com by default', async () => {
  const real = globalThis.fetch, saved = { key: process.env.WEATHERAPI_KEY, host: process.env.WEATHERAPI_HOST }
  const asked = []
  globalThis.fetch = async url => { asked.push(new URL(String(url)).host); return { ok: true, status: 200, json: async () => ({ current: { temp_c: 5, feelslike_c: 4, wind_kph: 7, condition: { text: 'Clear' } } }) } }
  process.env.WEATHERAPI_KEY = 'test-key'
  try {
    delete process.env.WEATHERAPI_HOST
    assert.equal((await fetchWeatherAPI(48.2, 16.4)).temp, 5)
    process.env.WEATHERAPI_HOST = 'eu.weatherapi.example'
    await fetchWeatherAPI(48.2, 16.4)
    assert.deepEqual(asked, ['api.weatherapi.com', 'eu.weatherapi.example'])
  } finally {
    globalThis.fetch = real
    for (const [k, v] of [['WEATHERAPI_KEY', saved.key], ['WEATHERAPI_HOST', saved.host]]) if (v === undefined) delete process.env[k]; else process.env[k] = v
  }
})

// Open-Meteo's shared model request: a refused or broken request is null, so the blend counts as thin
// (lib/forecast-cache.js); an answer is the list of models with data; the global models an answer lacks are
// named, since they answer everywhere (Vienna 2026-11-09: 10 of 18 sources kept 15 minutes, one failed
// source reported, the rest silently missing).
test('fetchOpenMeteoModels — a refused, broken or error answer is null, not an empty list', async () => {
  const real = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('{"error":true,"reason":"Too many concurrent requests"}', { status: 429 })
    assert.equal(await fetchOpenMeteoModels(46, 12), null)
    globalThis.fetch = async () => new Response('{"error":true,"reason":"Cannot initialize WeatherVariable"}', { status: 200 })
    assert.equal(await fetchOpenMeteoModels(46, 12), null)
    globalThis.fetch = async () => { throw new Error('socket hang up') }
    assert.equal(await fetchOpenMeteoModels(46, 12), null)
    globalThis.fetch = async () => new Response(JSON.stringify(omMore))
    assert.equal((await fetchOpenMeteoModels(46, 12)).length, 9)
  } finally { globalThis.fetch = real }
})

test('missingModels — null is the whole request; a list lacking a global model names it; regional models may be absent', () => {
  assert.deepEqual(missingModels(null), ['open-meteo-models'])
  assert.deepEqual(missingModels(parseOpenMeteoModels(omMore)), []) // Lienz: NBM (US only) absent, every global model there
  assert.deepEqual(missingModels(parseOpenMeteoModels(omMore).filter(r => r.apiId !== 'jma')), ['jma'])
  assert.deepEqual(missingModels([]), GLOBAL_MODELS)
  assert.deepEqual(GLOBAL_MODELS, ['ukmo', 'gem', 'jma', 'cma', 'aifs'])
})

test('modelSource — a failed shared request gives null for a model, not a crash', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async () => new Response('busy', { status: 503 })
  try {
    assert.equal(await modelSource('ukmo')(47.0001, 13.0001), null)
  } finally { globalThis.fetch = real }
})

// Quota item 2 (2026-11-09): ECMWF, GFS, ICON and Météo-France share one request, read at its
// 15-minute step (the value `current` gave each of them alone), and the extras (UV, air, details,
// yesterday) are kept an hour per spot: twelve Open-Meteo requests per forecast miss become nine,
// and four of those only once an hour per place.
const omNow = fs.readFileSync(new URL('./__fixtures__/om-now-lienz.json', import.meta.url), 'utf8') // recorded 2026-11-09 19:27 UTC with each model's own `current` beside it: every value equal

test('fetchECMWF / fetchGFS / fetchICON / fetchMeteoFrance — one request for the four per spot, each model its own 15-minute reading; refused, all four are null', async () => {
  const real = globalThis.fetch
  const asked = []
  globalThis.fetch = async url => { asked.push(String(url)); return new Response(String(url).includes('open-meteo.com') ? omNow : '[]') } // '[]': the request counter's database bump
  const upstream = () => asked.filter(u => u.includes('open-meteo.com'))
  try {
    const spot = [46.8289, 12.76903]
    const [ecmwf, gfs, icon, mf] = await Promise.all([fetchECMWF(...spot), fetchGFS(...spot), fetchICON(...spot), fetchMeteoFrance(...spot)])
    assert.equal(upstream().length, 1)
    assert.ok(upstream()[0].endsWith('&minutely_15=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code&models=ecmwf_ifs025,gfs_seamless,icon_seamless,meteofrance_seamless&forecast_minutely_15=1&timezone=GMT'), upstream()[0])
    assert.equal(callWeight(upstream()[0]), 2) // 5 variables × 4 models; one request each was 4 calls
    assert.deepEqual(ecmwf, { apiId: 'ecmwf', displayName: 'ECMWF IFS', temp: 6, feelsLike: 4.4, rainPct: 69, rainIsProb: true, windKmh: 2, condition: 'Cloudy' })
    assert.deepEqual([gfs, icon, mf].map(r => [r.apiId, r.displayName, r.temp]), [['gfs', 'NOAA GFS', 5], ['icon', 'DWD ICON', 5.5], ['meteofrance', 'Météo-France', 6.7]])
    assert.deepEqual([mf.rainPct, mf.rainIsProb], [null, false]) // Météo-France gives no probability
    globalThis.fetch = async url => { asked.push(String(url)); return new Response('{"error":true,"reason":"Too many concurrent requests"}', { status: 429 }) }
    assert.deepEqual(await Promise.all([fetchECMWF(47.5, 13.5), fetchGFS(47.5, 13.5), fetchICON(47.5, 13.5), fetchMeteoFrance(47.5, 13.5)]), [null, null, null, null])
    assert.equal(upstream().length, 3, 'the four share the refused request and its one retry')
  } finally { globalThis.fetch = real }
})

test('fetchOpenMeteoExtras / fetchOpenMeteoDetails / fetchYesterdayTemp — one set of requests per spot per hour, then from memory; a failed answer is asked again', async () => {
  const real = globalThis.fetch
  const asked = []
  const answers = async url => {
    const u = String(url)
    asked.push(u)
    if (u.includes('air-quality-api')) return new Response(JSON.stringify({ current: { european_aqi: 21, birch_pollen: 3 } }))
    if (u.includes('uv_index')) return new Response(JSON.stringify({ current: { uv_index: 2.3 } }))
    if (u.includes('snowfall')) return new Response(JSON.stringify({ current: { snowfall: 0, visibility: 12000, cloudcover: 40, soil_temperature_0cm: 4.5, precipitation: 0 } }))
    if (u.includes('archive-api')) return new Response(JSON.stringify({ daily: { temperature_2m_max: [8], temperature_2m_min: [2] } }))
    return new Response('[]') // the request counter's database bump
  }
  const upstream = () => asked.filter(u => u.includes('open-meteo.com')).length
  globalThis.fetch = answers
  const spot = [47.1234, 13.4567]
  try {
    const a = await Promise.all([fetchOpenMeteoExtras(...spot), fetchOpenMeteoDetails(...spot), fetchYesterdayTemp(...spot)])
    assert.deepEqual(a, [{ uvIndex: 2.3, aqi: 21, pollen: 3 }, { snowfallMm: 0, visibilityKm: 12, cloudCover: 40, groundTemp: 4.5, precipMm: 0 }, 5])
    assert.equal(upstream(), 4) // UV, air, details, archive
    assert.deepEqual(await Promise.all([fetchOpenMeteoExtras(...spot), fetchOpenMeteoDetails(...spot), fetchYesterdayTemp(...spot)]), a)
    assert.equal(upstream(), 4, 'within the hour nothing is asked again')
    mock.timers.enable({ apis: ['Date'], now: Date.now() })
    try {
      mock.timers.tick(60 * 60 * 1000 + 1)
      await Promise.all([fetchOpenMeteoExtras(...spot), fetchOpenMeteoDetails(...spot), fetchYesterdayTemp(...spot)])
      assert.equal(upstream(), 8, 'an hour later: asked once more')
    } finally { mock.timers.reset() }
    // a failed answer is not kept
    globalThis.fetch = async url => { asked.push(String(url)); return new Response('', { status: 500 }) }
    assert.equal(await fetchOpenMeteoDetails(48.2, 16.37), null)
    assert.equal(await fetchOpenMeteoDetails(48.2, 16.37), null)
    assert.equal(asked.filter(u => u.includes('snowfall')).length, 4, 'two asks for the spot that failed, after the two kept ones')
  } finally { globalThis.fetch = real }
})

// 2026-11-10: a refused request is asked once more, and "not covered here" is not a failure.
test('tfetch — refused by Open-Meteo for being one too many at that instant: asked once more a moment later; a limit per minute is not asked again', async () => {
  const real = globalThis.fetch
  const asked = []
  let answers = []
  globalThis.fetch = async url => { if (!String(url).includes('open-meteo.com')) return new Response('[]'); asked.push(String(url)); return answers.shift() }
  const busy = () => new Response('{"error":true,"reason":"Too many concurrent requests"}', { status: 429 })
  try {
    answers = [busy(), new Response('{"current":{"temperature_2m":5.5}}')]
    const ok = await tfetch('https://api.open-meteo.com/v1/forecast?latitude=10&longitude=20&current=temperature_2m')
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { current: { temperature_2m: 5.5 } })
    assert.equal(asked.length, 2)
    answers = [busy(), busy(), new Response('{}')]
    assert.equal((await tfetch('https://api.open-meteo.com/v1/forecast?latitude=11&longitude=20&current=temperature_2m')).status, 429, 'refused twice: the refusal goes back to the caller')
    assert.equal(asked.length, 4, 'one retry, not more')
    answers = [new Response('{"error":true,"reason":"Minutely API request limit exceeded. Please try again in one minute."}', { status: 429 }), new Response('{}')]
    assert.equal((await tfetch('https://api.open-meteo.com/v1/forecast?latitude=12&longitude=20&current=temperature_2m')).status, 429)
    assert.equal(asked.length, 5, 'the minute limit is not asked again')
  } finally { globalThis.fetch = real }
})

test('fetchNWS / fetchBrightSky — inside the box but not covered (404 for the point): not applicable, like outside the box; any other failure is still a failure', async () => {
  const real = globalThis.fetch
  let status = 404
  globalThis.fetch = async () => new Response('{"detail":"No sources match your criteria"}', { status })
  try {
    assert.equal(await fetchNWS(43.6532, -79.3832), undefined) // Toronto: inside NWS's box, not on its grid
    assert.equal(await fetchBrightSky(50.0755, 14.4378), undefined) // Prague: no station of theirs in reach
    status = 503
    assert.equal(await fetchNWS(43.6532, -79.3832), null)
    assert.equal(await fetchBrightSky(50.0755, 14.4378), null)
    assert.equal(await fetchNWS(48.2, 16.37), undefined) // Vienna: outside the box, never asked
  } finally { globalThis.fetch = real }
})

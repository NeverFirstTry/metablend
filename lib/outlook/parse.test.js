import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseOpenMeteoMulti, dailyFromHourly } from './parse.js'
import { OM_MODELS, BOXES, inBox } from './models.js'

const hoursOf = (date, n) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${date}T00:00:00Z`) + i * 3600e3).toISOString().slice(0, 16))

const MODELS = [{ id: 'a', model: 'aaa' }, { id: 'b', model: 'bbb' }]
function synthetic() {
  const time = hoursOf('2026-09-29', 48)
  return {
    utc_offset_seconds: 7200,
    hourly: {
      time,
      temperature_2m_aaa: time.map((_, i) => 10 + i / 10),
      precipitation_probability_aaa: time.map(() => 30),
      precipitation_aaa: time.map(() => 0.2),
      wind_speed_10m_aaa: time.map(() => 12),
      weather_code_aaa: time.map(() => 61),
      temperature_2m_bbb: time.map((_, i) => (i < 30 ? 11 : null)), // model ends 6 h into day 2
    },
    daily: {
      time: ['2026-09-29', '2026-09-30'],
      temperature_2m_max_aaa: [20, 22], temperature_2m_min_aaa: [10, 11],
      precipitation_sum_aaa: [1.2, 0], precipitation_probability_max_aaa: [60, 10],
      wind_speed_10m_max_aaa: [25, 18], weather_code_aaa: [61, 1],
      temperature_2m_max_bbb: [19, 21], temperature_2m_min_bbb: [9, 12],
      sunrise: ['2026-09-29T07:01', '2026-09-30T07:03'],
      sunset: ['2026-09-29T18:40', '2026-09-30T18:38'],
    },
  }
}

test('parseOpenMeteoMulti — one series per model with hourly and daily points', () => {
  const r = parseOpenMeteoMulti(synthetic(), MODELS)
  assert.equal(r.utcOffsetSec, 7200)
  const a = r.series.find(s => s.id === 'a')
  assert.equal(a.hourly.length, 48)
  assert.deepEqual(a.hourly[0], { t: '2026-09-29T00:00', temp: 10, pop: 30, precip: 0.2, wind: 12, code: 61 })
  assert.deepEqual(a.daily[0], { date: '2026-09-29', max: 20, min: 10, pop: 60, precip: 1.2, wind: 25, code: 61 })
  assert.equal(a.daily.length, 2)
})

test('parseOpenMeteoMulti — a day the model only partly covers gets no daily value', () => {
  const b = parseOpenMeteoMulti(synthetic(), MODELS).series.find(s => s.id === 'b')
  assert.equal(b.hourly.length, 30)
  assert.deepEqual(b.daily.map(d => d.date), ['2026-09-29'])
  assert.equal(b.hourly[0].pop, null) // no probability column → null, never 0
})

test('parseOpenMeteoMulti — sunrise/sunset with or without a model suffix', () => {
  assert.deepEqual(parseOpenMeteoMulti(synthetic(), MODELS).sun, { sunrise: '07:01', sunset: '18:40' })
  const j = synthetic()
  j.daily.sunrise_aaa = j.daily.sunrise
  j.daily.sunset_aaa = j.daily.sunset
  delete j.daily.sunrise
  delete j.daily.sunset
  assert.deepEqual(parseOpenMeteoMulti(j, MODELS).sun, { sunrise: '07:01', sunset: '18:40' })
})

test('parseOpenMeteoMulti — missing models are skipped; garbage returns null', () => {
  assert.equal(parseOpenMeteoMulti(synthetic(), [{ id: 'x', model: 'nope' }]).series.length, 0)
  assert.equal(parseOpenMeteoMulti(null), null)
  assert.equal(parseOpenMeteoMulti({ hourly: {} }), null)
})

test('parseOpenMeteoMulti — real recorded response (Vienna) parses into sane series', () => {
  const fx = JSON.parse(readFileSync(new URL('./__fixtures__/om-multi-vienna.json', import.meta.url)))
  const ids = parseOpenMeteoMulti(fx, OM_MODELS).series.map(s => s.id)
  for (const id of ['ecmwf', 'gfs', 'icon', 'knmi']) assert.ok(ids.includes(id), id)
  assert.ok(!ids.includes('metno-nordic'), 'MET Nordic does not cover Vienna')
  for (const s of parseOpenMeteoMulti(fx, OM_MODELS).series) {
    for (const p of s.hourly) {
      assert.match(p.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      assert.ok(p.temp > -60 && p.temp < 60)
    }
  }
})

test('dailyFromHourly — needs enough samples per day', () => {
  const hourly = hoursOf('2026-09-29', 30).map((t, i) => ({ t, temp: i, pop: i === 3 ? 70 : null, precip: 0.5, wind: i, code: null }))
  assert.deepEqual(dailyFromHourly(hourly), [{ date: '2026-09-29', max: 23, min: 0, pop: 70, precip: 12, wind: 23, code: null }])
  assert.equal(dailyFromHourly(hourly, 6).length, 2)
})

test('inBox — coverage boxes of the national services', () => {
  assert.equal(inBox(BOXES.germany, 52.52, 13.4), true)
  assert.equal(inBox(BOXES.germany, 48.21, 16.37), false) // Vienna is outside DWD MOSMIX via Bright Sky
  assert.equal(inBox(BOXES.nordic, 59.33, 18.07), true)
  assert.equal(inBox(BOXES.conus, 41.88, -87.63), true)
})

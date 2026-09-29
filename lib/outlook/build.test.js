import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOutlook } from './build.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))
const VIENNA = { name: 'Vienna', country: 'Austria', lat: 48.21, lon: 16.37 }

// One synthetic model (ECMWF's column names) over `days` days from Oct 1.
function synthMulti(days = 10, offset = 3600) {
  const start = Date.UTC(2026, 9, 1)
  const time = Array.from({ length: days * 24 }, (_, i) => new Date(start + i * 3600e3).toISOString().slice(0, 16))
  const dates = Array.from({ length: days }, (_, i) => new Date(start + i * 864e5).toISOString().slice(0, 10))
  return {
    utc_offset_seconds: offset,
    hourly: { time, temperature_2m_ecmwf_ifs025: time.map(() => 12), precipitation_probability_ecmwf_ifs025: time.map(() => 20) },
    daily: { time: dates, temperature_2m_max_ecmwf_ifs025: dates.map(() => 16), temperature_2m_min_ecmwf_ifs025: dates.map(() => 8) },
  }
}
const SYNTH_NOW = Date.UTC(2026, 9, 1, 4, 30) // 05:30 local at UTC+1

test('buildOutlook — the recorded Vienna response becomes hours, days and headlines', () => {
  const multi = fx('om-multi-vienna.json')
  const now = Date.parse(`${multi.hourly.time[6]}:00Z`) - multi.utc_offset_seconds * 1000 + 20 * 60e3 // 06:20 local, day 1
  const { payload, series } = buildOutlook({ geo: VIENNA, region: 'europe', multi, now })
  assert.ok(series.length >= 5)
  assert.equal(payload.hourly[0].t, multi.hourly.time[6])
  assert.ok(payload.hourly.length >= 48)
  assert.equal(payload.days[0].date, multi.daily.time[0])
  assert.ok(payload.headlines.h48)
  assert.ok(payload.headlines.d7)
  assert.deepEqual(payload.notes, [])
  assert.ok(payload.sources.every(s => typeof s.name === 'string' && s.name.length))
})

test('buildOutlook — no climate: no normals, no 14-day headline, no records', () => {
  const { payload } = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), now: SYNTH_NOW })
  assert.deepEqual(payload.normals, [])
  assert.equal(payload.headlines.d14, null)
  assert.equal(payload.records, null)
  assert.equal(payload.nowLocal, '2026-10-01T05:00')
})

test('buildOutlook — week 2 without an ensemble is flagged; with one it gets member bands', () => {
  const without = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), now: SYNTH_NOW }).payload
  assert.deepEqual(without.notes, ['ensemble_unavailable'])
  const daily = { time: ['2026-10-09', '2026-10-10'] }
  for (let m = 0; m < 20; m++) {
    daily[`temperature_2m_max_member${String(m + 1).padStart(2, '0')}_ncep_gefs025`] = [10 + m, 10 + m]
    daily[`temperature_2m_min_member${String(m + 1).padStart(2, '0')}_ncep_gefs025`] = [m, m]
    daily[`precipitation_sum_member${String(m + 1).padStart(2, '0')}_ncep_gefs025`] = [0, 0]
  }
  const withEns = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), ensemble: { daily }, now: SYNTH_NOW }).payload
  assert.deepEqual(withEns.notes, [])
  assert.equal(withEns.days[8].members, 20)
  assert.equal(withEns.days[8].rainPct, 0)
})

test('buildOutlook — climate gives normals, a trend headline and records', () => {
  const time = [], mx = [], mn = [], pr = []
  for (const y of [2023, 2024]) for (let d = 1; d <= 20; d++) {
    time.push(`${y}-10-${String(d).padStart(2, '0')}`); mx.push(15); mn.push(5); pr.push(d % 4 === 0 ? 3 : 0)
  }
  const climate = { daily: { time, temperature_2m_max: mx, temperature_2m_min: mn, precipitation_sum: pr } }
  const { payload } = buildOutlook({ geo: VIENNA, region: 'europe', multi: synthMulti(), climate, now: SYNTH_NOW })
  assert.equal(payload.normals[0].max, 15)
  // highs of 16 vs a normal of 15: +1.0 in both weeks → warmer, no shift
  assert.deepEqual((({ dir, shift }) => ({ dir, shift }))(payload.headlines.d14), { dir: 'warmer', shift: null })
  assert.equal(payload.records.hottest.temp, 15)
})

test('buildOutlook — no Open-Meteo and no fallback: empty, flagged fewer_sources', () => {
  const { payload } = buildOutlook({ geo: VIENNA, region: 'europe', multi: null, now: SYNTH_NOW })
  assert.equal(payload.hourly.length, 0)
  assert.equal(payload.days.length, 0)
  assert.deepEqual(payload.notes, ['fewer_sources'])
})

test('buildOutlook — MET Norway steps in when Open-Meteo fails', () => {
  const met = fx('metno-oslo.json')
  const now = Date.parse(met.properties.timeseries[2].time)
  const { payload, series } = buildOutlook({ geo: { name: 'Oslo', country: 'Norway', lat: 59.91, lon: 10.75 }, region: 'europe', multi: null, met, now })
  assert.deepEqual(series.map(s => s.id), ['met-norway'])
  assert.ok(payload.hourly.length > 0)
  // MET's 6-hourly tail reaches ~9 days, so with no ensemble the week-2 note is honest too
  assert.deepEqual(payload.notes, ['fewer_sources', 'ensemble_unavailable'])
})

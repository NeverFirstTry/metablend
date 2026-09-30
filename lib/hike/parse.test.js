import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSummitMulti } from './parse.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

test('parseSummitMulti — the recorded Großglockner response, one series per model at 3798 m', () => {
  const p = parseSummitMulti(fx('om-summit-glockner.json'))
  assert.equal(p.elevation, 3798)
  assert.ok(p.series.length >= 5)
  const icon = p.series.find(s => s.id === 'icon')
  assert.ok(icon.hourly.length >= 48)
  const h = icon.hourly[12]
  for (const k of ['temp', 'feels', 'pop', 'cape', 'fl', 'w700']) assert.equal(typeof h[k], 'number', k)
  assert.match(p.sun.sunrise, /^\d\d:\d\d$/)
  // every forecast day carries its own sun times
  const days = Object.keys(p.sunByDate)
  assert.equal(days.length, 3)
  assert.ok(days.every(d => /^\d{4}-\d\d-\d\d$/.test(d) && /^\d\d:\d\d$/.test(p.sunByDate[d].sunset)))
  assert.deepEqual(p.sunByDate[days[0]], p.sun)
})

test('parseSummitMulti — a variable a model lacks is null, not a crash', () => {
  const json = {
    utc_offset_seconds: 3600, elevation: 2000,
    hourly: { time: ['2026-10-01T00:00', '2026-10-01T01:00'], temperature_2m_ecmwf_ifs025: [1, 2], cape_ecmwf_ifs025: [null, 50] },
    daily: {},
  }
  const p = parseSummitMulti(json)
  assert.deepEqual(p.series.map(s => s.id), ['ecmwf'])
  assert.equal(p.series[0].hourly[0].cape, null)
  assert.equal(p.series[0].hourly[1].cape, 50)
  assert.equal(p.series[0].hourly[0].fl, null)
  assert.deepEqual(p.sun, { sunrise: null, sunset: null })
})

test('parseSummitMulti — garbage in, null out', () => {
  assert.equal(parseSummitMulti(null), null)
  assert.equal(parseSummitMulti({ hourly: {} }), null)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blendSummitHourly, summitDays } from './blend.js'
import { weatherIcon } from '../weather.js'

const EMPTY = { temp: null, feels: null, pop: null, precip: null, code: null, cape: null, fl: null, lpi: null, cloud: null, wind10: null, w850: null, w700: null, w600: null }
const series = (id, pts) => ({ id, hourly: pts.map(([t, o]) => ({ t, ...EMPTY, ...o })) })
const NOW = '2026-10-01T10:00'

test('blendSummitHourly — weighted summit consensus with band, wind from the levels, storm risk', () => {
  const out = blendSummitHourly([
    series('icon', [[NOW, { temp: -2, feels: -8, pop: 40, cape: 1200, fl: 3200, w700: 30, w600: 50, code: 95 }]]),
    series('gfs', [[NOW, { temp: 0, feels: -4, pop: 20, cape: 800, fl: 3400, w700: 50, w600: 70, code: 3 }]]),
  ], { h48: { icon: 0.75, gfs: 0.25 } }, { nowLocal: NOW, elev: 3600 })
  const h = out[0]
  assert.equal(h.temp, -1.5)
  assert.deepEqual([h.lo, h.hi], [-2, 0])
  assert.equal(h.feels, -7)
  assert.equal(h.windKmh, 45) // icon 40, gfs 60 at 3600 m
  assert.equal(h.freezingLevel, 3250)
  assert.equal(h.rainPct, 35)
  assert.equal(h.cape, 1100)
  assert.equal(h.storm, 'high')
  assert.equal(h.icon, weatherIcon(95)) // the heavier-weighted model's weather
  assert.equal(h.n, 2)
})

test('blendSummitHourly — skips the past; derives the freezing level; no CAPE → unknown storm risk', () => {
  const out = blendSummitHourly(
    [series('ecmwf', [['2026-10-01T09:00', { temp: 5 }], [NOW, { temp: -3.25, pop: 10 }]])],
    {}, { nowLocal: NOW, elev: 3000 },
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].freezingLevel, 2500)
  assert.equal(out[0].storm, null)
  assert.equal(out[0].windKmh, null)
})

test('summitDays — per-day summit extremes, worst storm risk, partial today', () => {
  const hours = [
    { t: '2026-10-01T22:00', temp: -4, feels: -10, windKmh: 30, rainPct: 10, freezingLevel: 2800, storm: 'low', icon: 'a' },
    { t: '2026-10-01T23:00', temp: -5, feels: -12, windKmh: 35, rainPct: 5, freezingLevel: 2700, storm: 'low', icon: 'b' },
    ...Array.from({ length: 24 }, (_, i) => ({
      t: `2026-10-02T${String(i).padStart(2, '0')}:00`,
      temp: i === 14 ? 2 : -3, feels: -9, windKmh: i === 15 ? 55 : 20, rainPct: i === 16 ? 60 : 10,
      freezingLevel: 3000 + i * 10, storm: i === 16 ? 'moderate' : 'low', icon: i === 12 ? '☀️' : 'x',
    })),
  ]
  const [d1, d2] = summitDays(hours)
  assert.equal(d1.partial, true)
  assert.deepEqual([d1.tempMax, d1.tempMin, d1.storm], [-4, -5, 'low'])
  assert.equal(d2.partial, false)
  assert.deepEqual([d2.tempMax, d2.tempMin, d2.windMax, d2.rainPct, d2.storm], [2, -3, 55, 60, 'moderate'])
  assert.deepEqual([d2.freezingMin, d2.freezingMax], [3000, 3230])
  assert.equal(d2.feelsMin, -9)
  assert.equal(d2.icon, '☀️')
})

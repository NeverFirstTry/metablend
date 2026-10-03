import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseNowcastQuery, nowcastUrl, blendSteps, intensity, upcoming, summarize, nowcastRain } from './nowcast.js'

// a fake Open-Meteo response: 10 quarters from 14:00 local (UTC+2), one series per model
const OFF = 7200
const times = Array.from({ length: 10 }, (_, i) => `2026-10-03T${String(14 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)
const om = series => ({ utc_offset_seconds: OFF, minutely_15: { time: times, ...Object.fromEntries(Object.entries(series).map(([m, v]) => [`precipitation_${m}`, v])) } })
const at = hhmm => Date.parse(`2026-10-03T${hhmm}:00Z`) - OFF * 1000
const dry = Array(10).fill(0)

test('parseNowcastQuery / nowcastUrl — rounded coordinates, every model, 15-minute steps', () => {
  assert.deepEqual(parseNowcastQuery(new URLSearchParams('lat=48.2082&lon=16.3738')), { lat: 48.21, lon: 16.37 })
  assert.equal(parseNowcastQuery(new URLSearchParams('lat=95&lon=1')), null)
  assert.equal(parseNowcastQuery(new URLSearchParams('lat=x')), null)
  const u = nowcastUrl({ lat: 48.21, lon: 16.37 })
  assert.match(u, /minutely_15=precipitation/)
  assert.match(u, /models=best_match,icon_d2,/)
  assert.match(u, /timezone=auto/)
})

test('blendSteps — fine models win over best_match; median, majority vote, agreement; nulls dropped', () => {
  const nc = blendSteps(om({ best_match: Array(10).fill(9), icon_d2: [0, 0.2, 0.5, null, ...dry.slice(4)], knmi_harmonie_arome_europe: [0, 0.4, 0, 0.3, ...dry.slice(4)], dmi_harmonie_arome_europe: [0, 0.1, 0.7, 0.9, ...dry.slice(4)] }))
  assert.equal(nc.precision, 'fine')
  assert.equal(nc.models, 3)
  assert.deepEqual(nc.steps[1], { t: '2026-10-03T14:15', mm: 0.2, wet: true, agree: 1 })
  assert.deepEqual(nc.steps[2], { t: '2026-10-03T14:30', mm: 0.5, wet: true, agree: 0.67 })
  assert.deepEqual(nc.steps[3], { t: '2026-10-03T14:45', mm: 0.6, wet: true, agree: 1 }) // icon_d2 null: two models vote
  assert.equal(nc.steps[0].wet, false)
})

test('blendSteps — only the global model: rough; nothing usable: null', () => {
  const nc = blendSteps(om({ best_match: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0] }))
  assert.equal(nc.precision, 'rough')
  assert.equal(nc.models, 1)
  assert.equal(blendSteps({}), null)
  assert.equal(blendSteps(om({ best_match: Array(10).fill(null) })), null)
})

test('blendSteps — the recorded Vienna response has fine models', () => {
  const nc = blendSteps(JSON.parse(fs.readFileSync(new URL('./__fixtures__/nowcast-vienna.json', import.meta.url))))
  assert.equal(nc.precision, 'fine')
  assert.ok(nc.models >= 2)
  assert.ok(nc.steps.length >= 9)
})

test('intensity — light / moderate / heavy per 15 minutes', () => {
  assert.deepEqual([0.1, 0.59, 0.6, 1.9, 2, 5].map(intensity), ['light', 'light', 'moderate', 'moderate', 'heavy', 'heavy'])
})

test('upcoming / summarize — skips past quarters; dry, start (with and without an end), stop, all; stale data is null', () => {
  const wetAt = (from, to, mm = 0.3) => Array.from({ length: 10 }, (_, i) => (i >= from && i < to ? mm : 0))
  const one = series => blendSteps(om({ icon_d2: series }))
  assert.deepEqual(summarize(one(dry), at('14:05')), { kind: 'dry' })
  // 14:05 now: the 14:00 quarter is current; rain 14:30–15:00
  assert.deepEqual(summarize(one(wetAt(2, 4)), at('14:05')), { kind: 'start', at: '2026-10-03T14:30', minutes: 25, until: '2026-10-03T15:00', duration: 30, intensity: 'light', agree: 1 })
  assert.equal(summarize(one(wetAt(5, 10, 3)), at('14:05')).until, null)
  assert.equal(summarize(one(wetAt(5, 10, 3)), at('14:05')).intensity, 'heavy')
  assert.deepEqual(summarize(one(wetAt(0, 3, 1)), at('14:05')), { kind: 'stop', until: '2026-10-03T14:45', intensity: 'moderate' })
  assert.deepEqual(summarize(one(Array(10).fill(0.2)), at('14:05')), { kind: 'all', intensity: 'light' })
  // 20 min later the 14:00 quarter is gone: the first upcoming step is 14:15
  assert.equal(upcoming(one(dry), at('14:20'))[0].t, '2026-10-03T14:15')
  assert.equal(summarize(one(dry), at('16:00')), null) // fewer than 4 quarters left
})

test('nowcastRain — dry now, start in 10–60 min, agreeing fine models; otherwise null; rough or stale: undefined', () => {
  const start = blendSteps(om({ icon_d2: [0, 0, 0.3, 0.3, 0, ...dry.slice(5)], knmi_harmonie_arome_europe: [0, 0, 0.4, 0, 0, ...dry.slice(5)], dmi_harmonie_arome_europe: [0, 0, 0.2, 0.2, 0, ...dry.slice(5)] }))
  assert.deepEqual(nowcastRain(start, at('14:05')), { from: '2026-10-03T14:30', minutes: 25, duration: 30, intensity: 'light', nowcast: true })
  assert.equal(nowcastRain(start, at('14:25')), null) // 5 min ahead: too close to be news
  const soon = blendSteps(om({ icon_d2: [0, 0, 0, 0, 0, 0, 0.3, 0.3, 0, 0] }))
  assert.equal(nowcastRain(soon, at('14:05')), null) // 85 min ahead: wait for a later run
  // agreement: 3 of 5 models wet is a wet step but only 0.6 agreement — no alert; 4 of 5 is 0.8
  const five = (a, b, c, d, e) => blendSteps(om({ icon_d2: a, knmi_harmonie_arome_europe: b, dmi_harmonie_arome_europe: c, metno_nordic: d, ukmo_uk_deterministic_2km: e }))
  const w = [0, 0, 0.3, 0, ...dry.slice(4)]
  assert.equal(nowcastRain(five(w, w, w, dry, dry), at('14:05')), null)
  assert.equal(nowcastRain(five(w, w, w, w, dry), at('14:05')).from, '2026-10-03T14:30')
  const raining = blendSteps(om({ icon_d2: [0.5, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 0] }))
  assert.equal(nowcastRain(raining, at('14:05')), null) // already raining: no "starts in"
  assert.equal(nowcastRain(blendSteps(om({ best_match: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0] })), at('14:05')), undefined)
  assert.equal(nowcastRain(start, at('16:00')), undefined)
  assert.equal(nowcastRain(null, at('14:05')), undefined)
})

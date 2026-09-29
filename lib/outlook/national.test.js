import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseNws, parseSmhi, parseBrightSky, parseMetNorway, parseNational } from './national.js'

const fx = name => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

function assertSeries(s, id) {
  assert.equal(s.id, id)
  assert.ok(s.hourly.length > 20, `${id}: ${s.hourly.length} hourly points`)
  for (const p of s.hourly) {
    assert.match(p.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    assert.ok(p.temp > -60 && p.temp < 60, `${id} temp ${p.temp}`)
    assert.ok(p.pop == null || (p.pop >= 0 && p.pop <= 100), `${id} pop ${p.pop}`)
  }
  assert.equal(new Set(s.hourly.map(p => p.t)).size, s.hourly.length, `${id}: duplicate hours`)
  assert.equal(new Set(s.daily.map(d => d.date)).size, s.daily.length)
  for (const d of s.daily) assert.ok(d.max >= d.min)
}

test('parseNws — hourly periods in the gridpoint’s own local time', () => {
  const s = parseNws(fx('nws-chicago.json'))
  assertSeries(s, 'nws')
  assert.ok(s.hourly.some(p => p.pop != null))
})

test('parseSmhi — UTC steps shifted into city-local time', () => {
  assertSeries(parseSmhi(fx('smhi-stockholm.json'), 7200), 'smhi')
})

test('parseBrightSky — MOSMIX forecast records only', () => {
  assertSeries(parseBrightSky(fx('brightsky-berlin.json'), 7200), 'brightsky')
})

test('parseMetNorway — fallback series keeps coarse days (≥ 4 samples)', () => {
  const s = parseMetNorway(fx('metno-oslo.json'), 7200)
  assertSeries(s, 'met-norway')
  assert.ok(s.daily.length >= 2)
})

test('national parsers return null on garbage', () => {
  for (const f of [parseNws, parseSmhi, parseBrightSky, parseMetNorway]) assert.equal(f(null, 0), null)
})

test('parseNational — only the services that answered', () => {
  assert.deepEqual(parseNational({}, 0), [])
  assert.deepEqual(parseNational({ nws: fx('nws-chicago.json'), smhi: null }, 0).map(s => s.id), ['nws'])
})

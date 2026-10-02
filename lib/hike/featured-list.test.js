import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REGIONS, GRADES, checkPeak, nearest, byRegion, lastCityPos } from './featured-list.js'

const P = (id, lat, lon, region, over = {}) => ({ id, name: id, lat, lon, elev: 2000, country: 'AT', kind: 'peak', region, grade: 'T2', ...over })

test('checkPeak — a good entry passes; every broken field is named', () => {
  const seen = new Set()
  assert.equal(checkPeak(P('rax', 47.69, 15.69, 'eastern-alps'), seen), null)
  assert.match(checkPeak(P('rax', 47.69, 15.69, 'eastern-alps'), seen), /repeats/)
  assert.match(checkPeak(P('a', 47, 15, 'alps'), new Set()), /region/)
  assert.match(checkPeak(P('b', 47, 15, 'eastern-alps', { grade: 'T7' }), new Set()), /grade/)
  assert.match(checkPeak(P('c', 47, 15, 'eastern-alps', { elev: null }), new Set()), /height/)
  assert.match(checkPeak(P('d', 95, 15, 'eastern-alps'), new Set()), /coordinates/)
  assert.match(checkPeak(P('E e', 47, 15, 'eastern-alps'), new Set()), /id/)
  assert.ok(REGIONS.includes('central-europe') && REGIONS.includes('mediterranean'))
  assert.deepEqual(GRADES, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'L', 'WS', 'ZS', 'S'])
})

test('nearest — by distance with km; nothing without a usable position', () => {
  const peaks = [P('far', 46.0, 7.7, 'western-alps'), P('near', 47.8, 13.1, 'eastern-alps'), P('mid', 47.4, 11.0, 'eastern-alps')]
  const r = nearest(peaks, { lat: 47.8, lon: 13.0 }, 2)
  assert.deepEqual(r.map(p => p.id), ['near', 'mid'])
  assert.ok(r[0].km < 10 && r[1].km > 100)
  assert.deepEqual(nearest(peaks, null), [])
  assert.deepEqual(nearest(peaks, { lat: NaN, lon: 13 }), [])
})

test('byRegion — REGIONS order, empty regions left out, unknown regions dropped', () => {
  const peaks = [P('teide', 28.27, -16.64, 'pyrenees-iberia'), P('rax', 47.69, 15.69, 'eastern-alps'), P('x', 0, 0, 'atlantis'), P('zugspitze', 47.42, 10.98, 'eastern-alps')]
  assert.deepEqual(byRegion(peaks).map(g => [g.region, g.peaks.map(p => p.id)]), [['eastern-alps', ['rax', 'zugspitze']], ['pyrenees-iberia', ['teide']]])
})

test('lastCityPos — the cached forecast of the last city; null for missing, old or broken data', () => {
  const store = data => key => data[key] ?? null
  const json = JSON.stringify({ ts: 1, json: { city: 'Lienz', lat: 46.83, lon: 12.77 } })
  assert.deepEqual(lastCityPos(store({ mb_forecast_last: 'lienz', mb_forecast_lienz: json })), { lat: 46.83, lon: 12.77 })
  assert.equal(lastCityPos(store({})), null)
  assert.equal(lastCityPos(store({ mb_forecast_last: 'lienz', mb_forecast_lienz: JSON.stringify({ json: { city: 'Lienz' } }) })), null)
  assert.equal(lastCityPos(store({ mb_forecast_last: 'lienz', mb_forecast_lienz: '{broken' })), null)
  assert.equal(lastCityPos(() => { throw new Error('blocked') }), null)
})

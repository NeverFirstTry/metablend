import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceName, SOURCE_NAMES, countSources, covers, publicSources } from './sources.js'

test('sourceName — known ids get display names, unknown ids pass through', () => {
  assert.equal(sourceName('ecmwf'), 'ECMWF IFS')
  assert.equal(sourceName('metno-nordic'), 'MET Nordic')
  assert.equal(sourceName('open-meteo'), 'Open-Meteo')
  assert.equal(sourceName('mystery'), 'mystery')
})

test('sourceName — Weatherstack is retired: named on old leaderboard rows, gone from the live list; Météo-France is in', () => {
  assert.equal(sourceName('weatherstack'), 'Weatherstack')
  assert.ok(!('weatherstack' in SOURCE_NAMES))
  assert.equal(SOURCE_NAMES.meteofrance, 'Météo-France')
  for (const id of ['cma', 'aifs', 'meteoswiss', 'italiameteo', 'nbm']) assert.ok(SOURCE_NAMES[id], id)
})

test('sourceName — Tomorrow.io, World Weather Online and NASA POWER are retired (2026-10-29): named on old rows, gone from the live list', () => {
  for (const [id, name] of [['tomorrow', 'Tomorrow.io'], ['world-weather-online', 'World Weather Online'], ['nasa-power', 'NASA POWER']]) {
    assert.equal(sourceName(id), name)
    assert.ok(!(id in SOURCE_NAMES), id)
  }
})

test('countSources — the weather sources that answered: not the ones down, not our own MetaBlend Local (made from the others)', () => {
  const list = [{ apiId: 'ecmwf' }, { apiId: 'gfs' }, { apiId: 'owm', down: true }, { apiId: 'metablend', synthetic: true }]
  assert.equal(countSources(list), 2)
  assert.equal(countSources([]), 0)
})

test('covers: regional sources only in their own region, global ones everywhere', () => {
  assert.equal(covers('nws', 'europe'), false)
  assert.equal(covers('nws', 'north_america'), true)
  assert.equal(covers('metno-nordic', 'asia'), false)
  assert.equal(covers('icon', 'oceania'), true)
})

test('publicSources: Visual Crossing keeps its name and timing, never its readings', () => {
  const [vc, icon] = publicSources([
    { apiId: 'visual-crossing', displayName: 'Visual Crossing', temp: 3, feelsLike: 1, rainPct: 10, windKmh: 9, condition: 'Clear', responseMs: 70 },
    { apiId: 'icon', displayName: 'DWD ICON', temp: 4 },
  ])
  assert.deepEqual(vc, { apiId: 'visual-crossing', displayName: 'Visual Crossing', responseMs: 70, valuesHidden: true })
  assert.equal(icon.temp, 4)
  assert.equal(publicSources([{ apiId: 'visual-crossing', displayName: 'Visual Crossing', down: true, responseMs: 5000 }])[0].down, true)
})

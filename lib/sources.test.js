import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceName, SOURCE_NAMES, countSources } from './sources.js'

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

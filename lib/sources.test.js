import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceName, SOURCE_NAMES } from './sources.js'

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

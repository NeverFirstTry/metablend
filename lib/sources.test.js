import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceName, SOURCE_NAMES, countSources, covers, publicSources, sortSources } from './sources.js'

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

test('sortSources: MetaBlend Local first, then by the whole percent shown, equal percents by name, no answer last', () => {
  const share = { ecmwf: 0.12, icon: 0.084, gfs: 0.076, 'visual-crossing': 0.2, 'met-norway': 0.081, smhi: 0.12 }
  const list = [
    { apiId: 'gfs', displayName: 'NOAA GFS' }, { apiId: 'owm', displayName: 'OpenWeatherMap', down: true },
    { apiId: 'icon', displayName: 'DWD ICON' }, { apiId: 'smhi', displayName: 'SMHI (Nordics)' },
    { apiId: 'visual-crossing', displayName: 'Visual Crossing', valuesHidden: true }, { apiId: 'met-norway', displayName: 'MET Norway' },
    { apiId: 'ecmwf', displayName: 'ECMWF IFS' }, { apiId: 'metablend', displayName: 'MetaBlend Local', synthetic: true },
  ]
  const order = sortSources(list, s => share[s.apiId] ?? 0).map(s => s.apiId)
  // 8.4 % and 8.1 % both show as 8 %: by name (DWD ICON before MET Norway), not by the hidden decimals
  assert.deepEqual(order, ['metablend', 'visual-crossing', 'ecmwf', 'smhi', 'icon', 'met-norway', 'gfs', 'owm'])
  assert.deepEqual(sortSources([...list].reverse(), s => share[s.apiId] ?? 0).map(s => s.apiId), order, 'the order the API sends does not matter')
})

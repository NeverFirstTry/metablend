import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearestStation, chooseTruth, summitErrors, stationTemps } from './shadow.js'

const STATIONS = [[11204, 46.8263, 12.7867], [11252, 47.0, 12.45], [11035, 48.2486, 16.3564]]

test('nearestStation: the closest official station within 10 km, or none', () => {
  const lienz = nearestStation(STATIONS, 46.8298, 12.7694)
  assert.equal(lienz.id, 11204)
  assert.ok(lienz.km > 1 && lienz.km < 2, `${lienz.km}`)
  assert.equal(nearestStation(STATIONS, 40, 10), null)
})

test('chooseTruth: a station in town beats an airport up to 60 km away; the airport is used without one', () => {
  assert.deepEqual(chooseTruth({ stationTemp: 5.2, stationKm: 1.4, metarTemps: [7, 9], metarKm: 40 }), { truth: 'station', actual: 5.2, km: 1.4 })
  assert.deepEqual(chooseTruth({ stationTemp: null, stationKm: 1.4, metarTemps: [7, 9], metarKm: 40 }), { truth: 'metar', actual: 8, km: 40 })
  assert.deepEqual(chooseTruth({ stationTemp: 0, stationKm: 3, metarTemps: [], metarKm: null }), { truth: 'station', actual: 0, km: 3 }) // zero degrees is a reading
  assert.equal(chooseTruth({ stationTemp: null, stationKm: null, metarTemps: [], metarKm: null }), null)
})

const parsed = {
  series: [
    { id: 'ecmwf', hourly: [{ t: '2026-11-06T17:00', temp: -9 }, { t: '2026-11-06T18:00', temp: -8.5 }, { t: '2026-11-06T19:00', temp: -8 }] },
    { id: 'icon', hourly: [{ t: '2026-11-06T18:00', temp: -11.25 }] },
    { id: 'gem', hourly: [{ t: '2026-11-06T17:00', temp: -7 }] }, // no value for this hour: it doesn't vote
  ],
}

test('summitErrors: each model at the current local hour, against the summit station', () => {
  assert.deepEqual(summitErrors(parsed, '2026-11-06T18', -10), { ecmwf: 1.5, icon: -1.25 })
})

test('stationTemps: the latest reading per station; a missing reading is left out, not zero', () => {
  const body = { features: [
    { properties: { station: '11204', parameters: { TL: { data: [null] } } } },
    { properties: { station: '11343', parameters: { TL: { data: [-9.4] } } } },
    { properties: { station: '11126', parameters: { TL: { data: [0] } } } },
  ] }
  const temps = stationTemps(body)
  assert.equal(temps.get(11343), -9.4)
  assert.equal(temps.get(11126), 0)
  assert.equal(temps.has(11204), false)
  assert.equal(stationTemps(null).size, 0)
})

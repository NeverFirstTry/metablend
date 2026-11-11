// A place's climate table is asked from Open-Meteo once a year and kept in the database
// (lib/climate-store.js): a kept table is read without any request, a missing or year-old one is asked
// once and kept, and when the archive does not answer the old table still serves. The table itself:
// lib/outlook/climate.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadClimate, climateKey, climateUrl } from './climate-store.js'
import { callWeight } from './open-meteo.js'
import { climateTable, tableNormals, tableRainyDays, indexArchive, normalsFor, rainyDaysNormal } from './outlook/climate.js'

const NOW = Date.parse('2026-11-11T12:00:00Z')
const daily = { time: ['2016-01-01', '2016-01-02'], temperature_2m_max: [3, 5], temperature_2m_min: [-2, 0], temperature_2m_mean: [0, 2], precipitation_sum: [2, 0] }
// a database of one table, recording what was read and written
function fakeDb(row) {
  const calls = []
  return { calls, from: table => ({
    select: () => ({ eq: (col, key) => ({ limit: async () => { calls.push(['read', table, key]); return { data: row ? [row] : [] } } }) }),
    upsert: async value => { calls.push(['write', table, value.key, value.fetched_at]); row = value; return { error: null } },
  }) }
}
const upstream = answer => { const asked = []; return { asked, fetchJson: async (url, opts) => { asked.push([url, opts.kind]); return answer } } }

test('a kept table younger than a year is read from the database: Open-Meteo is not asked', async () => {
  const table = { v: 2, elev: 673, years: 10, max: [], min: [], wet: [], months: [] }
  const db = fakeDb({ key: '46.83,12.77', data: table, fetched_at: '2026-03-01T00:00:00Z' }), up = upstream({ daily })
  assert.equal(await loadClimate(46.8289, 12.7693, { db, fetchJson: up.fetchJson, now: NOW }), table)
  assert.deepEqual(up.asked, [])
  assert.deepEqual(db.calls, [['read', 'place_climate', '46.83,12.77']])
})

test('a place without a table is asked once, as one 10-year request for both readers, and the table is kept', async () => {
  const db = fakeDb(null), up = upstream({ daily })
  const table = await loadClimate(46.8289, 12.7693, { db, fetchJson: up.fetchJson, now: NOW })
  assert.equal(table.v, 2)
  assert.equal(table.months[0].avgTemp, 1)
  assert.equal(up.asked.length, 1)
  const [url, kind] = up.asked[0]
  assert.equal(kind, 'climate')
  assert.equal(url, climateUrl(46.8289, 12.7693, new Date(NOW)))
  assert.match(url, /archive-api\.open-meteo\.com.*latitude=46\.83&longitude=12\.77&start_date=2016-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum/)
  assert.equal(callWeight(url), 104.37, 'what the one request weighs by their calculator')
  assert.deepEqual(db.calls.at(-1), ['write', 'place_climate', climateKey(46.8289, 12.7693), new Date(NOW).toISOString()])
  // the next reader finds it
  assert.equal((await loadClimate(46.8289, 12.7693, { db, fetchJson: up.fetchJson, now: NOW + 86_400_000 })).v, 2)
  assert.equal(up.asked.length, 1)
})

test('a table older than a year is asked again; when the archive gives nothing the old table still serves', async () => {
  const old = { v: 2, elev: 673, years: 10, max: [1], min: [0], wet: [0], months: [] }
  const stale = () => ({ key: '46.83,12.77', data: old, fetched_at: '2025-11-01T00:00:00Z' })
  let db = fakeDb(stale()), up = upstream({ daily })
  const fresh = await loadClimate(46.8289, 12.7693, { db, fetchJson: up.fetchJson, now: NOW })
  assert.notEqual(fresh, old)
  assert.equal(up.asked.length, 1)
  assert.equal(db.calls.at(-1)[0], 'write')
  db = fakeDb(stale()); up = upstream(null)
  assert.equal(await loadClimate(46.8289, 12.7693, { db, fetchJson: up.fetchJson, now: NOW }), old)
  assert.equal(db.calls.some(c => c[0] === 'write'), false, 'nothing is written over the old table')
  // no table and no answer: the outlook goes without normals and the planner says unavailable
  assert.equal(await loadClimate(1, 2, { db: fakeDb(null), fetchJson: upstream(null).fetchJson, now: NOW }), null)
})

// ten full years of made-up days: a seasonal curve, a little year-to-year shift, rain every seventh day
function archive() {
  const d = { time: [], temperature_2m_max: [], temperature_2m_min: [], temperature_2m_mean: [], precipitation_sum: [] }
  let i = 0
  for (let t = Date.UTC(2016, 0, 1); t <= Date.UTC(2025, 11, 31); t += 864e5, i++) {
    const date = new Date(t).toISOString().slice(0, 10), max = 10 + 12 * Math.sin((i % 365) / 58) + (Number(date.slice(0, 4)) % 3) * 0.7
    d.time.push(date); d.temperature_2m_max.push(Math.round(max * 10) / 10); d.temperature_2m_min.push(Math.round((max - 8.3) * 10) / 10); d.temperature_2m_mean.push(Math.round((max - 4) * 10) / 10); d.precipitation_sum.push(i % 7 === 0 ? 2.4 : 0)
  }
  return { daily: d }
}

test('the kept table gives the same normals and rainy days as the 10-year rows for every day of a year, and the planner its months', () => {
  const raw = archive(), rows = indexArchive(raw), table = climateTable(raw)
  assert.equal(table.years, 10)
  assert.ok(JSON.stringify(table).length < 6000, 'small enough to keep per place')
  const year = Array.from({ length: 366 }, (_, k) => new Date(Date.UTC(2028, 0, 1 + k)).toISOString().slice(0, 10)) // a leap year: 29 February too
  assert.deepEqual(tableNormals(table, year), normalsFor(rows, year))
  for (let k = 0; k + 7 <= year.length; k += 5) assert.equal(tableRainyDays(table, year.slice(k, k + 7)), rainyDaysNormal(rows, year.slice(k, k + 7)), year[k])
  const jan = raw.daily.time.map((date, i) => [date, raw.daily.temperature_2m_mean[i], raw.daily.precipitation_sum[i]]).filter(([date]) => date.slice(5, 7) === '01')
  assert.equal(table.months.length, 12)
  assert.equal(table.months[0].avgTemp, Math.round(jan.reduce((n, [, t]) => n + t, 0) / jan.length * 10) / 10)
  assert.equal(table.months[0].avgRainDays, Math.round(jan.filter(([, , p]) => p >= 1).length / 10))
  assert.equal(climateTable(null), null)
  assert.equal(climateTable({ daily: { time: [] } }), null)
})

test('callWeight follows the calculator on open-meteo.com/en/pricing (read 2026-11-11)', () => {
  const u = (q, host = 'api.open-meteo.com/v1/forecast') => `https://${host}?${q}`
  const vars = n => Array.from({ length: n }, (_, i) => `v${i}`).join(',')
  const tenYears = 'start_date=2016-01-01&end_date=2025-12-31'
  assert.equal(callWeight(u(`latitude=1&longitude=2&daily=${vars(2)}&${tenYears}`, 'archive-api.open-meteo.com/v1/archive')), 52.19, '2 daily values, 10 years: 52.2')
  assert.equal(callWeight(u(`latitude=1&longitude=2&daily=${vars(3)}&${tenYears}`, 'archive-api.open-meteo.com/v1/archive')), 78.28, '3 daily values, 10 years: 78.3')
  assert.equal(callWeight(u(`latitude=1,2,3,4,5,6,7,8&longitude=1,2,3,4,5,6,7,8&hourly=${vars(5)}&forecast_days=1`)), 8, '5 values for 8 places: 8.0')
  assert.equal(callWeight(u(`latitude=1,2&longitude=1,2&hourly=${vars(15)}&forecast_days=28`)), 6, '15 values, 28 days, 2 places: 6.0')
  assert.equal(callWeight(u(`latitude=1,2,3,4&longitude=1,2,3,4&hourly=${vars(3)}&models=a,b,c&forecast_days=1`)), 4, '3 values, 3 models, 4 places: 4.0')
  assert.equal(callWeight(u(`latitude=1&longitude=2&hourly=${vars(2)}&forecast_days=28`)), 1, '2 values, 28 days: 1.0')
  assert.equal(callWeight(u(`latitude=1&longitude=2&hourly=${vars(15)}&daily=${vars(2)}&models=${vars(10)}&forecast_days=8`)), 17, 'a summit forecast: 17.0')
})

// The Open-Meteo count says who asked (open_meteo_calls.kind, 2026-11-10): the routes and the two
// library callers are run for real with every outside call faked (lib/test-route-fakes.js), and each
// bump of the counter must carry its caller's kind. Open-Meteo answers 404 here: a request that fails
// is counted like one that works, and what the routes answer is not this test's subject.
// Not covered: the station calibration's five summit requests (kind 'shadow'), which only go out when
// GeoSphere reports a temperature for the station on top.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { json, seen, answerWith } from './test-route-fakes.js'

// every searched name is found, so the routes get as far as their Open-Meteo requests
answerWith(({ url }) => (url.includes('geocoding-api.open-meteo.com/v1/search')
  ? json({ results: [{ id: 2775220, name: 'Lienz', latitude: 46.8289, longitude: 12.7693, country: 'Austria', country_code: 'AT', admin1: 'Tyrol' }] })
  : undefined))

// the kinds of the counter's bumps while `run` ran, the name lookups left out
async function kinds(run) {
  const from = seen.length
  await run()
  await new Promise(r => setTimeout(r, 30)) // the count is fire and forget
  const all = seen.slice(from).filter(c => c.url.includes('/rpc/bump_open_meteo_calls')).map(c => JSON.parse(c.body).p_kind)
  return [...new Set(all)].filter(k => k !== 'geocoding').sort()
}
const req = (path, n) => new Request(`https://metablend.app${path}`, { headers: { 'x-forwarded-for': `203.0.113.${n}` } })

test('each caller is counted under its own kind: forecast, outlook, summit, nowcast, heights, route; the climate table of a place, which the outlook and the planner read, as climate', async () => {
  const { GET: forecast } = await import('../app/api/forecast/route.js')
  assert.deepEqual(await kinds(() => forecast(req('/api/forecast?city=kind-one&lang=en', 51))), ['forecast'])
  const { GET: outlook } = await import('../app/api/outlook/route.js')
  assert.deepEqual(await kinds(() => outlook(req('/api/outlook?city=kind-two&lang=en', 52))), ['climate', 'outlook'])
  const { GET: hike } = await import('../app/api/hike/route.js')
  assert.deepEqual(await kinds(() => hike(req('/api/hike?lat=47.074&lon=12.694&elev=3798&name=Grossglockner', 53))), ['summit'])
  const { GET: nowcast } = await import('../app/api/nowcast/route.js')
  assert.deepEqual(await kinds(() => nowcast(req('/api/nowcast?lat=46.83&lon=12.77', 54))), ['nowcast'])
  const { GET: planner } = await import('../app/api/planner/route.js')
  assert.deepEqual(await kinds(() => planner(req('/api/planner?city=kind-three', 55))), ['climate'])
  const { fetchElevations } = await import('./hike/sources.js')
  assert.deepEqual(await kinds(() => fetchElevations([{ lat: 47.07, lon: 12.69 }])), ['heights'])
  const { routeWeather } = await import('./route/weather.js')
  const { getJson } = await import('./outlook/http.js')
  const points = [[47.05, 12.70, 1900], [47.06, 12.70, 2400], [47.07, 12.69, 3100]].map(([lat, lon, ele]) => ({ lat, lon, ele }))
  assert.deepEqual(await kinds(() => routeWeather({ points, date: new Date().toISOString().slice(0, 10) }, { getJson, getElevations: async () => null }).catch(() => null)), ['route'])
})

test('the name search is counted as geocoding, and a caller that names nothing as other', async () => {
  const { GET: forecast } = await import('../app/api/forecast/route.js')
  const from = seen.length
  await forecast(req('/api/forecast?city=kind-four&lang=en', 56))
  await new Promise(r => setTimeout(r, 30))
  const bumps = seen.slice(from).filter(c => c.url.includes('/rpc/bump_open_meteo_calls')).map(c => JSON.parse(c.body).p_kind)
  assert.ok(bumps.includes('geocoding'), `a new name is looked up at Open-Meteo (${bumps.join(', ')})`)
  assert.ok(bumps.every(k => k === 'forecast' || k === 'geocoding'))
  const { openMeteoFetch } = await import('./open-meteo.js')
  const before = seen.length
  await openMeteoFetch('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&current=temperature_2m')
  await new Promise(r => setTimeout(r, 30))
  assert.deepEqual(seen.slice(before).filter(c => c.url.includes('/rpc/bump_open_meteo_calls')).map(c => JSON.parse(c.body).p_kind), ['other'])
})

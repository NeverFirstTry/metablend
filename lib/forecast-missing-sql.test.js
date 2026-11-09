// The forecast must neither wait for nor break on two database helpers whose SQL is run by hand (dev
// first, then production) and may not be there yet: the Open-Meteo request counter
// (bump_open_meteo_calls, supabase/open-meteo-calls.sql) and the geocoder's own data (town_lookup and
// geocode_cache, supabase/geocode-cache.sql). The forecast route is called for real with every outside
// call faked (lib/test-route-fakes.js). A hanging counter is cut off after a short timeout and never
// holds up the answer; a missing function or table is logged once per instance, not once per call.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { seen, reset, answerWith, json } = await import('./test-route-fakes.js')
const { GET } = await import('../app/api/forecast/route.js')

const ask = city => GET(new Request(`https://metablend.app/api/forecast?city=${city}&lang=en`, { headers: { 'x-forwarded-for': '203.0.113.7' } }))
const timed = async city => { const t = Date.now(); const res = await ask(city); return { res, ms: Date.now() - t } }
const missing = (code, message) => json({ code, details: null, hint: null, message }, 404)
const logged = scope => seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/error_log') && JSON.parse(c.body).scope === scope).length
const bumps = () => seen.filter(c => c.url.includes('/rest/v1/rpc/bump_open_meteo_calls'))
const until = async (ok, ms) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await new Promise(r => setTimeout(r, 25)) }

// the outside world for one forecast: Open-Meteo geocodes and answers, MET Norway is down; `counter` and
// `geocodeHelpers` say how the database answers the counter and the geocoder's own lookups
function world({ counter = 'fast', geocodeHelpers = 'present' } = {}) {
  answerWith(({ url, method, signal }) => {
    const search = url.match(/geocoding-api\.open-meteo\.com\/v1\/search\?name=([^&]+)/)
    if (search) { const name = search[1][0].toUpperCase() + search[1].slice(1); return json({ results: [{ id: name.length * 1000, name, latitude: 47.07, longitude: 15.44, country: 'Austria', country_code: 'AT', admin1: 'Styria' }] }) }
    if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('current=')) return json({ current: { temperature_2m: 6.1, apparent_temperature: 4.0, precipitation_probability: 20, windspeed_10m: 9, weathercode: 2 } })
    if (url.includes('api.met.no')) return new Response('busy', { status: 503 })
    if (url.includes('/rest/v1/rpc/bump_open_meteo_calls')) {
      if (counter === 'fast') return json(12)
      if (counter === 'missing') return missing('PGRST202', 'Could not find the function public.bump_open_meteo_calls(p_calls, p_day, p_hour) in the schema cache')
      // hangs until the caller gives up on it (or forever, if it never does)
      return new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason ?? new Error('aborted'))))
    }
    if (geocodeHelpers === 'missing') {
      if (url.includes('/rest/v1/rpc/town_lookup')) return missing('PGRST202', 'Could not find the function public.town_lookup(lim, q) in the schema cache')
      if (url.includes('/rest/v1/geocode_cache')) return missing('PGRST205', "Could not find the table 'public.geocode_cache' in the schema cache")
    }
  })
}

test('a counter that hangs holds up nothing: the forecast answers in normal time, and each bump is cut off within 2 s', async () => {
  reset(); world({ counter: 'fast' })
  const normal = await timed('graz')
  assert.equal(normal.res.status, 200)
  reset(); world({ counter: 'hang' })
  const hanging = await timed('linz')
  assert.equal(hanging.res.status, 200)
  assert.equal((await hanging.res.json()).city, 'Linz')
  assert.ok(hanging.ms < normal.ms + 500 && hanging.ms < 2000, `answered in ${hanging.ms} ms (normal: ${normal.ms} ms)`)
  const started = bumps()
  assert.ok(started.length >= 2, `the Open-Meteo requests were counted (${started.length})`)
  await until(() => started.every(c => c.signal?.aborted), 3000)
  assert.ok(started.every(c => c.signal?.aborted), 'every hanging bump was given up')
})

test('a counter function that is not there yet: the forecast answers 200, and the miss is logged once, not per call', async () => {
  reset(); world({ counter: 'missing' })
  for (const city of ['salzburg', 'villach']) assert.equal((await ask(city)).status, 200)
  await until(() => logged('open-meteo.count') > 0, 500)
  assert.ok(bumps().length >= 4, `several requests were counted (${bumps().length})`)
  assert.equal(logged('open-meteo.count'), 1)
})

test('the geocoder\'s helpers not there yet: the city is found through Open-Meteo, and each missing one is logged once', async () => {
  reset(); world({ geocodeHelpers: 'missing' })
  for (const city of ['bregenz', 'leoben']) {
    const res = await ask(city)
    assert.equal(res.status, 200)
    assert.equal((await res.json()).city, city[0].toUpperCase() + city.slice(1))
  }
  await until(() => logged('geocode.town-lookup') > 0 && logged('geocode.cache') > 0, 500)
  assert.equal(logged('geocode.town-lookup'), 1)
  assert.equal(logged('geocode.cache'), 1)
})

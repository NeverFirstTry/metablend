// The forecast route handler, called for real with every outside call faked: our towns (the database's
// town_lookup and towns_search, which name every place since 2026-11-12), Open-Meteo's weather,
// one failing source (MET Norway answers 503) and the database's REST API. A cold instance (empty
// in-memory cache) answers 200 with a blend; the same request again is served from the copy without
// another upstream call. The first version of the per-copy lifetime read a field of the copy on a miss
// and every forecast request failed with 500 (2026-11-09): this test calls the miss path.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
delete process.env.WEBHOOK_URL
for (const k of ['OPENWEATHERMAP_API_KEY', 'WEATHERAPI_KEY', 'VISUAL_CROSSING_KEY', 'PIRATE_WEATHER_KEY']) delete process.env[k]

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const calls = { upstream: 0, partialLogged: 0, counted: 0, geocoder: 0 }
const LIENZ = { id: 2772807, name: 'Lienz', alt: null, names: null, country: 'AT', region: 'Tyrol', population: 11800, lat: 46.8294, lon: 12.7698 }
let towns = [LIENZ] // what our own towns answer for the searched name (town_lookup: one of a town's names, exactly)
let ranked = [] // what the search ranks for it (towns_search), asked only when no town carries the name
let dailyLimit = false // when set, Open-Meteo's model request answers the daily-limit 429
// what each outside service answers
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.includes('geocoding-api.open-meteo.com') || url.includes('/rest/v1/geocode_cache')) { calls.geocoder++; return new Response('gone', { status: 410 }) } // never asked: every test checks
  if (url.includes('proj.supabase.co/rest/v1/rpc/town_lookup')) return towns === 'down' ? json({ message: 'upstream timeout' }, 503) : json(towns)
  if (url.includes('proj.supabase.co/rest/v1/rpc/towns_search')) return json(ranked)
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('current=')) {
    calls.upstream++
    return json({ current: { temperature_2m: 4.2, apparent_temperature: 2.1, precipitation_probability: 10, windspeed_10m: 7, weathercode: 1 } })
  }
  if (url.includes('api.met.no')) return new Response('busy', { status: 503 }) // a source that fails: the blend is thin
  if (dailyLimit && url.includes('api.open-meteo.com/v1/forecast') && url.includes('models=')) return new Response('{"error":true,"reason":"Daily API request limit exceeded"}', { status: 429 })
  if (url.includes('proj.supabase.co/rest/v1/error_log') && String(init?.body).includes('forecast.partial')) calls.partialLogged++
  if (url.includes('proj.supabase.co/rest/v1/rpc/bump_open_meteo_calls')) { calls.counted++; return json(12, 200) } // our Open-Meteo request count
  if (url.includes('proj.supabase.co/rest/v1/')) return json([], (init?.method ?? 'GET') === 'GET' ? 200 : 201)
  return new Response('not found', { status: 404 })
}

const { GET } = await import('../app/api/forecast/route.js')
const ask = (city = 'lienz', lang = 'en') => GET(new Request(`https://metablend.app/api/forecast?city=${city}&lang=${lang}`, { headers: { 'x-forwarded-for': '203.0.113.5' } }))
const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: PlaceName } = await import('../app/components/PlaceName.jsx')

test('a cold instance answers 200 with a blend; the next request is served from the copy, with no upstream call', async () => {
  const first = await ask()
  assert.equal(first.status, 200)
  const body = await first.json()
  assert.equal(body.city, 'Lienz')
  assert.ok(body.sources.some(s => s.apiId === 'open-meteo'), 'the blend carries the source that answered')
  assert.equal(typeof body.consensus.temp, 'number')
  assert.notEqual(body.cached, true)
  assert.equal(body.partial, true) // MET Norway failed
  assert.match(first.headers.get('cache-control'), /s-maxage=120\b/) // a thin blend: two minutes on the CDN too
  await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.partialLogged, 1, 'the thin blend was logged once (error_log, scope forecast.partial)')
  const upstreamAfterFirst = calls.upstream
  assert.ok(upstreamAfterFirst >= 1)
  assert.equal(calls.counted, 7, 'every Open-Meteo request of the miss was counted: seven weather requests (the name search was the eighth until 2026-11-12)')
  assert.equal(calls.geocoder, 0, 'the place came from our towns: no geocoder asked, nothing read from or written to the old geocoding cache')
  const countedAfterFirst = calls.counted

  const second = await ask()
  assert.equal(second.status, 200)
  const again = await second.json()
  assert.equal(again.cached, true)
  assert.equal(again.city, 'Lienz')
  assert.equal(calls.upstream, upstreamAfterFirst, 'the copy was served, Open-Meteo was not asked again')
  assert.equal(calls.partialLogged, 1, 'a served copy logs nothing')
  assert.equal(calls.counted, countedAfterFirst, 'a served copy counts no Open-Meteo request')
  assert.match(second.headers.get('cache-control'), /s-maxage=(1[01]\d|120)\b/) // what is left of the two minutes
})

// Open-Meteo's daily limit is reached: its sources are gone until midnight UTC, so the thin blend keeps the
// full 15 minutes instead of being refetched every 2 minutes against the limit (another place, so the copy
// of the first test is not served).
test('a blend thinned by Open-Meteo\'s daily limit is kept 15 minutes, not 2', async () => {
  dailyLimit = true
  try {
    const res = await ask('lienz-limited')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.partial, true)
    assert.match(res.headers.get('cache-control'), /s-maxage=900\b/)
  } finally { dailyLimit = false }
})

// Nothing but the towns list knows where a place is. When it does not answer, the visitor is not told to check
// the spelling: the route answers 500 "Something went wrong", never cached (found on a preview without a
// database, 2026-11-13, where every place was "not found").
test('the towns list does not answer: 500 and not "not found", nothing kept, no geocoder asked', async () => {
  towns = 'down'
  try {
    const res = await ask('lienz-while-down')
    assert.equal(res.status, 500)
    assert.match((await res.json()).error, /Something went wrong/)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(calls.geocoder, 0)
  } finally { towns = [LIENZ] }
})

// Our towns are the only place names there are. A name none of them carries is not found, and nothing outside
// is asked for it. The beginning of a name finds the town the search ranks first; a name the search merely
// resembles (a misspelling) does not: a forecast for the wrong place is worse than "not found".
test('a name our towns lack: 404; the beginning of a name finds its town; a look-alike does not; no geocoder is asked for any of them', async () => {
  towns = []
  try {
    const none = await ask('atlantis')
    assert.equal(none.status, 404)
    assert.match((await none.json()).error, /"atlantis" was not found/)
    ranked = [{ ...LIENZ, exact: false, prefix: true }]
    const start = await ask('lien')
    assert.equal(start.status, 200)
    const body = await start.json()
    assert.equal(body.city, 'Lienz')
    assert.equal(body.country, 'Austria')
    ranked = [{ ...LIENZ, exact: false, prefix: false }]
    assert.equal((await ask('liens')).status, 404, 'ranked by likeness alone: not a find')
    assert.equal(calls.geocoder, 0)
  } finally { towns = [LIENZ]; ranked = [] }
})

// The place line in the reader's language: one of our towns, typed in English, read in German, Japanese and
// English. The route names the city in that language from the town's own names and sends the country's ISO
// code; the page names the country from it. Every user had seen the country in English (2026-11-10).
test("the place line in the reader's language: Wien, Österreich; ウィーン, オーストリア; Vienna, Austria", async () => {
  towns = [{ id: 2761369, name: 'Vienna', alt: 'Wien | ウィーン', names: { de: 'Wien', ja: 'ウィーン' }, country: 'AT', region: 'Vienna', population: 1691468, lat: 48.2085, lon: 16.3721 }]
  try {
    for (const [lang, line, typed] of [['de', 'Wien, Österreich', 'vienna'], ['ja', 'ウィーン, オーストリア', 'vienna'], ['en', 'Vienna, Austria', 'vienna'], ['en', 'Vienna, Austria', 'wien'], ['de', 'Wien, Österreich', encodeURIComponent('ウィーン')]]) {
      const res = await ask(typed, lang)
      assert.equal(res.status, 200, lang)
      const body = await res.json()
      assert.equal(body.cc, 'AT', lang)
      assert.equal(body.learnCity, 'Vienna', `${lang}: filed under the English name whatever the reader's language`)
      assert.equal(render(h(PlaceName, { city: body.city, cc: body.cc, country: body.country, lang })).replace(/<[^>]+>/g, ''), line, lang)
    }
    assert.equal(calls.geocoder, 0)
  } finally { towns = [LIENZ] }
})

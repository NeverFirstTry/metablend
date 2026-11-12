// The outlook is kept 2 hours and the summit forecast 1 hour, each 30 minutes more while a new copy is
// built (2026-11-10; both were 30 minutes plus an hour). The routes are called for real with every
// outside call faked (lib/test-route-fakes.js) and the clock set into the recorded answers. For the
// outlook the test also reads the kept answer two hours later, the way the pages do (atNow), and
// compares it with what the route answers fresh at that hour: the hour strip starts at the same hour.
import './test-jsx-hooks.js'
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { json, answerWith } from './test-route-fakes.js'
import { atNow } from './outlook/at-now.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const vienna = read('./outlook/__fixtures__/om-multi-vienna.json'), glockner = read('./hike/__fixtures__/om-summit-glockner.json')
const body = text => new Response(text, { headers: { 'content-type': 'application/json' } })
answerWith(({ url }) => {
  if (url.includes('/rest/v1/rpc/town_lookup')) return json([{ id: 2761369, name: 'Vienna', alt: 'Wien', names: { de: 'Wien' }, country: 'AT', region: 'Vienna', population: 1691468, lat: 48.2085, lon: 16.3721 }]) // our towns name the place
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('elevation=')) return body(glockner)
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('daily=')) return body(vienna)
})
// the moment 20 minutes into hour `i` of a recorded answer (its hours are local time)
const at = (recorded, i) => { const r = JSON.parse(recorded); return Date.parse(`${r.hourly.time[i]}:00Z`) - r.utc_offset_seconds * 1000 + 20 * 60e3 }
const ask = (GET, path, n) => GET(new Request(`https://metablend.app${path}`, { headers: { 'x-forwarded-for': `203.0.113.${n}` } }))

test('the outlook: kept 2 hours and 30 minutes more; read 2 hours later through atNow, its hours start where a fresh answer\'s do', async () => {
  mock.timers.enable({ apis: ['Date'], now: at(vienna, 9) })
  try {
    const { GET } = await import('../app/api/outlook/route.js')
    const res = await ask(GET, '/api/outlook?city=cache-town&lang=en', 61)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'public, s-maxage=7200, stale-while-revalidate=1800')
    const kept = await res.json()
    assert.equal(kept.hourly[0].t, JSON.parse(vienna).hourly.time[9])

    mock.timers.setTime(at(vienna, 11))
    const fresh = await (await ask(GET, '/api/outlook?city=cache-town&lang=en', 61)).json()
    const read = atNow(kept) // the reader's own clock, as on the page
    assert.equal(read.hourly[0].t, fresh.hourly[0].t, 'the hour strip starts at the current hour')
    assert.equal(read.nowLocal, fresh.nowLocal)
    assert.deepEqual(read.headlines, fresh.headlines)
    assert.deepEqual(read.bestTime, fresh.bestTime)
  } finally { mock.timers.reset() }
})

test('the summit forecast: kept 1 hour and 30 minutes more, 90 minutes at most as before', async () => {
  mock.timers.enable({ apis: ['Date'], now: at(glockner, 9) })
  try {
    const { GET } = await import('../app/api/hike/route.js')
    const res = await ask(GET, '/api/hike?lat=47.074&lon=12.694&elev=3798&name=Grossglockner', 62)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'public, s-maxage=3600, stale-while-revalidate=1800')
    assert.ok((await res.json()).hourly.length > 24)
  } finally { mock.timers.reset() }
})

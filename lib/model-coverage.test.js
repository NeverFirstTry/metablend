// Open-Meteo charges variables × models for a request, also for a regional model asked outside its
// area, where it has nothing to say. The forecast, the outlook and the summit forecast therefore ask a
// regional model only inside its box (MODEL_BOXES, lib/outlook/models.js). The requests are made for
// real with every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith } from './test-route-fakes.js'

const { OM_MODELS, MODEL_BOXES, modelCovers } = await import('./outlook/models.js')
const { MORE_MODELS, GLOBAL_MODELS, fetchOpenMeteoModels } = await import('./weather.js')
const { fetchOpenMeteoMultiRaw } = await import('./outlook/sources.js')
const { fetchSummitRaw } = await import('./hike/sources.js')

const LIENZ = [46.8289, 12.76903], VIENNA = [48.2082, 16.3738], OSLO = [59.9139, 10.7522], NEW_YORK = [40.7128, -74.006], PERTH = [-31.9523, 115.8613]
const REGIONAL = ['knmi_harmonie_arome_europe', 'dmi_harmonie_arome_europe', 'metno_nordic', 'meteoswiss_icon_ch1', 'italia_meteo_arpae_icon_2i', 'ncep_nbm_conus']
const EUROPE_ONLY = REGIONAL.filter(m => m !== 'ncep_nbm_conus')

// Open-Meteo answers one value for whatever was asked
const upstream = ({ url }) => {
  if (!url.includes('api.open-meteo.com/v1/forecast')) return
  const p = new URL(url).searchParams, hourly = { time: ['2026-11-12T12:00'] }
  for (const m of p.get('models').split(',')) for (const v of (p.get('hourly') ?? '').split(',')) hourly[`${v}_${m}`] = [v === 'weather_code' ? 1 : 2]
  return new Response(JSON.stringify({ utc_offset_seconds: 3600, hourly }), { headers: { 'content-type': 'application/json' } })
}
const asked = () => seen.filter(c => c.url.includes('api.open-meteo.com/v1/forecast')).map(c => new URL(c.url).searchParams.get('models').split(','))
const counted = async () => { await new Promise(r => setTimeout(r, 20)); return seen.filter(c => c.url.includes('/rpc/bump_open_meteo_calls')).map(c => JSON.parse(c.body)).map(b => [b.p_kind, b.p_calls]) }
const more = pick => MORE_MODELS.map(m => m[1]).filter(pick)
const outlook = pick => OM_MODELS.map(m => m.model).filter(pick)

test('every box belongs to a model that is asked, and a model without a box is asked everywhere', () => {
  const known = new Set([...OM_MODELS.map(m => m.model), ...MORE_MODELS.map(m => m[1])])
  assert.deepEqual(Object.keys(MODEL_BOXES).sort(), [...REGIONAL].sort())
  for (const m of Object.keys(MODEL_BOXES)) assert.ok(known.has(m), `${m} is not in a model list`)
  for (const [lat, lon] of [LIENZ, PERTH, NEW_YORK, [78, 15], [-54, -68]]) assert.equal(modelCovers('ecmwf_ifs025', lat, lon), true)
})

test('the boxes: the Alps have the four European models, Oslo also MET Nordic, New York only NBM, Perth none', () => {
  const inside = ([lat, lon]) => REGIONAL.filter(m => modelCovers(m, lat, lon))
  assert.deepEqual(inside(LIENZ), ['knmi_harmonie_arome_europe', 'dmi_harmonie_arome_europe', 'meteoswiss_icon_ch1', 'italia_meteo_arpae_icon_2i'])
  assert.deepEqual(inside(VIENNA), inside(LIENZ))
  assert.deepEqual(inside(OSLO), ['knmi_harmonie_arome_europe', 'dmi_harmonie_arome_europe', 'metno_nordic'])
  assert.deepEqual(inside(NEW_YORK), ['ncep_nbm_conus'])
  assert.deepEqual(inside(PERTH), [])
})

test('the forecast asks the global models everywhere and a regional one only inside its box: 4.5, 3 and 2.5 calls instead of 5', async () => {
  for (const [place, want, calls] of [
    [LIENZ, more(m => m !== 'ncep_nbm_conus'), 4.5],
    [NEW_YORK, more(m => !EUROPE_ONLY.includes(m)), 3],
    [PERTH, more(m => !REGIONAL.includes(m)), 2.5],
  ]) {
    reset(); answerWith(upstream)
    const rows = await fetchOpenMeteoModels(...place)
    assert.deepEqual(asked(), [want])
    assert.deepEqual(await counted(), [['forecast', calls]])
    assert.equal(rows.length, want.length)
    for (const id of GLOBAL_MODELS) assert.ok(rows.some(r => r.apiId === id), `${id} is asked everywhere`)
  }
})

test('the outlook leaves MET Nordic out in Vienna (11.7 calls instead of 13), asks all ten in Oslo and seven in Perth (9.1)', async () => {
  for (const [place, want, calls] of [
    [VIENNA, outlook(m => m !== 'metno_nordic'), 11.7],
    [OSLO, outlook(() => true), 13],
    [PERTH, outlook(m => !REGIONAL.includes(m)), 9.1],
  ]) {
    reset(); answerWith(upstream)
    assert.ok(await fetchOpenMeteoMultiRaw(...place))
    assert.deepEqual(asked(), [want])
    assert.deepEqual(await counted(), [['outlook', calls]])
  }
})

test('the summit forecast follows the same boxes: nine models on the Grossglockner, 15.3 calls instead of 17', async () => {
  reset(); answerWith(upstream)
  assert.ok(await fetchSummitRaw(47.074, 12.694, 3798))
  assert.deepEqual(asked(), [outlook(m => m !== 'metno_nordic')])
  assert.deepEqual(await counted(), [['summit', 15.3]])
})

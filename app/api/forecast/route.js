import { recentMean } from '@/lib/scoring'
import { statRows } from '@/lib/api-stats'
import { supabase } from '@/lib/supabase'
import { after } from 'next/server'
import { withErrorLog, logError } from '@/lib/log'
import { clientIp, isInternal, selfBase } from '@/lib/auth'
import { pickLang } from '@/lib/share'
import { parseNear } from '@/lib/geo'
import { geocodeCity, placeNames, shownIn } from '@/lib/geocode'
import {
  getRegion,
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchMETNorway, fetchVisualCrossing,
  fetchMeteoFrance, fetchOpenMeteoModels, fetchPirateWeather, fetchGeoSphere,
  fetchECMWF, fetchGFS, fetchICON, fetchNWS, fetchBrightSky, fetchSMHI,
  fetchOpenMeteoExtras, fetchOpenMeteoDetails, fetchYesterdayTemp, missingModels,
} from '@/lib/weather'
import { getCityBias } from '@/lib/blend'
import { isNightAt, localDateForLon } from '@/lib/localtime'
import { createRateLimiter } from '@/lib/ratelimit'
import { sourceName, isRetired, covers, publicSources } from '@/lib/sources'
import { heroCondition } from '@/lib/conditions'
import { blendNow } from '@/lib/consensus'
import { noStore } from '@/lib/no-store'
import { blendTtl, freshCopy, FULL_TTL, lostOpenMeteo } from '@/lib/forecast-cache'
import { keepAnswer, lastAnswer, placeKey } from '@/lib/last-answer'
import { dailyLimited, failuresSince } from '@/lib/open-meteo'

// Run a source fetcher with timing. `down` means it threw/timed out (vs. just
// being unavailable, e.g. no API key, which returns null without throwing).
async function timedFetch(id, fn) {
  const start = Date.now()
  try {
    const value = await fn()
    return { id, value, ms: Date.now() - start, down: false }
  } catch {
    return { id, value: null, ms: Date.now() - start, down: true }
  }
}

// "Right now" only — everything ahead (48 h / 7 / 14 days, climate, best
// time) is /api/outlook's job.
//
// Two cache layers: Vercel's CDN (shared by every visitor of a city, the one
// that actually saves upstream quota) and an in-memory copy per warm instance
// as a second line; a copy lives 15 minutes, a thin one (a source failed) 2
// (lib/forecast-cache.js). Errors are never cached.
const CACHE = new Map()
const cacheKey = (city, lang, near) => `${city.trim().toLowerCase()}|${lang}|${near ? `${near.lat},${near.lon}` : ''}`
const cdnHeaders = ttlSec => ({ 'Cache-Control': `public, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec * 2}` })

// Per-IP throttle on the expensive (cache-miss) path so nobody can drain the
// metered upstream weather APIs by spamming distinct cities. In-memory and
// best-effort (per warm instance, resets on cold start) — enough to stop casual
// abuse without a datastore. Cache hits below are free and never counted.
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 }) // cache-miss forecasts per minute, per IP

export const GET = withErrorLog('forecast', async (request) => {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')
  // a known language or English: anything else would be a fresh cache key (and
  // 16 upstream calls) per made-up value
  const lang = pickLang(searchParams.get('lang'))
  // where the search came from: tells same-name towns apart (lib/geo.js)
  const near = parseNear(searchParams.get('near'))

  if (!city) return noStore({ error: 'No city specified' }, 400)

  // serve a fresh in-memory copy if we have one — the CDN may keep it only
  // for what's left of its 15 minutes
  const key = cacheKey(city, lang, near)
  const cached = freshCopy(CACHE.get(key))
  if (cached) return Response.json({ ...cached.payload, cached: true }, { headers: cdnHeaders(Math.max(1, Math.round((cached.ttl - (Date.now() - cached.ts)) / 1000))) })

  // Cache miss → this request will hit the metered upstream APIs, so throttle.
  if (!isInternal(request) && limiter.limited(clientIp(request))) {
    return noStore({ error: 'Too many requests — please slow down.' }, 429)
  }

  // 1. Stadt → Koordinaten
  const geo = await geocodeCity(city, lang, near)
  if (!geo) {
    return noStore({ error: `"${city}" was not found. Check the spelling or pick a city from the suggestions.` }, 404)
  }

  const region = getRegion(geo.lat, geo.lon)
  // Everything this route stores or learns is filed under the place's English
  // name, whatever language it was searched in — "Wien", "Vienne" and "Vienna"
  // are one city (the outlook does the same); a same-name town picked by
  // position adds its region (lib/weather.js learnName). Fetched alongside
  // the sources; if the lookup fails, the searched name stands in. The visitor
  // sees the city in their own language where Open-Meteo has the name.
  const namesP = placeNames(geo, lang)
  const learnCityP = namesP.then(n => n.learn ?? geo.name)

  // 2. All source APIs in parallel, each timed — plus the extra national and
  // AI models, which come in one shared Open-Meteo request
  // and the extras (UV, air, details, yesterday), which needn't wait for them
  const asked = Date.now()
  const [[timed, models], [extras, details, yesterdayTemp]] = await Promise.all([Promise.all([Promise.all([
    timedFetch('open-meteo',           () => fetchOpenMeteo(geo.lat, geo.lon)),
    timedFetch('owm',                  () => fetchOWM(geo.lat, geo.lon)),
    timedFetch('weatherapi',           () => fetchWeatherAPI(geo.lat, geo.lon)),
    timedFetch('met-norway',           () => fetchMETNorway(geo.lat, geo.lon)),
    timedFetch('visual-crossing',      () => fetchVisualCrossing(geo.lat, geo.lon)),
    timedFetch('geosphere',            () => fetchGeoSphere(geo.lat, geo.lon)),
    timedFetch('ecmwf',                () => fetchECMWF(geo.lat, geo.lon)),
    timedFetch('gfs',                  () => fetchGFS(geo.lat, geo.lon)),
    timedFetch('icon',                 () => fetchICON(geo.lat, geo.lon)),
    timedFetch('meteofrance',          () => fetchMeteoFrance(geo.lat, geo.lon)),
    timedFetch('nws',                  () => fetchNWS(geo.lat, geo.lon)),
    timedFetch('brightsky',            () => fetchBrightSky(geo.lat, geo.lon)),
    timedFetch('smhi',                 () => fetchSMHI(geo.lat, geo.lon)),
    timedFetch('pirateweather',        () => fetchPirateWeather(geo.lat, geo.lon)), // off until PIRATE_WEATHER_KEY is set
  ]), timedFetch('open-meteo-models', () => fetchOpenMeteoModels(geo.lat, geo.lon))]), Promise.all([
    fetchOpenMeteoExtras(geo.lat, geo.lon),
    fetchOpenMeteoDetails(geo.lat, geo.lon),
    fetchYesterdayTemp(geo.lat, geo.lon),
  ])])

  // successful sources, tagged with their response time
  const results = timed
    .filter(t => t.value != null)
    .map(t => ({ ...t.value, responseMs: t.ms }))
    .concat((models.value ?? []).map(v => ({ ...v, responseMs: models.ms })))

  // sources that actively failed (threw / timed out) — shown as "down"
  const downSources = timed
    .filter(t => t.down)
    .map(t => ({ apiId: t.id, displayName: sourceName(t.id), down: true, responseMs: t.ms }))

  if (results.length === 0) return noStore({ error: 'No API data available' }, 500)
  const limited = dailyLimited() // Open-Meteo's daily limit: its sources stay away until midnight UTC
  // what gave nothing: sources that were asked and failed, and the global models missing from the shared
  // model answer (a model absent without failing thinned Vienna to 10 sources for 15 minutes, 2026-11-09)
  const failed = [...timed.filter(t => t.down || t.value === null).map(t => t.id), ...missingModels(models.value)]
  const ttl = blendTtl(failed, limited) // a thin blend is kept 2 minutes, not 15, unless the limit is the cause
  // logged (error_log, scope forecast.partial) so thin blends can be counted and checked the next day,
  // with what Open-Meteo answered to the requests of this miss that failed (status 0: no answer in time)
  if (failed.length) logError('forecast.partial', new Error(limited ? 'thin blend, Open-Meteo daily limit' : 'thin blend'), { city: geo.name, failed, limited, upstream: failuresSince(asked, `latitude=${geo.lat}&longitude=${geo.lon}`) })

  // Response-time + uptime stats (EMA on the response time, running up/down
  // counts), atomic via the bump_api_stats DB function. Before the kept blend
  // below: an answer from the kept copy counts its failed sources too.
  const attempts = statRows(timed)
  if (attempts.length) {
    const { error: rpcErr } = await supabase.rpc('bump_api_stats', {
      rows: attempts,
    })
    if (rpcErr) logError('forecast.stats', rpcErr)
  }

  // the request's own fields of the answer. A kept blend gets them from the request that reads it,
  // never from the one that built it: one request must not set what another one reads
  const named = async () => {
    const names = await namesP, learnCity = await learnCityP
    const shown = shownIn(lang, names.shown, learnCity)
    return {
      city:     names.shown, // the place's name as the geocoder gave it: the page asks by it again
      // what the reader sees where it differs (Chinese in simplified characters, lib/geocode.js shownIn)
      ...(shown !== names.shown ? { cityShown: shown } : {}),
      learnCity, // the key feedback reports are matched by (see above)
      country:  geo.country, // English; the page names it from cc in the reader's language
      cc:       geo.cc ?? null,
      lat:      geo.lat,
      lon:      geo.lon,
      region,
    }
  }
  const send = payload => {
    // expired copies go once the map grows (a warm instance lives for hours)
    if (CACHE.size > 500) for (const [k, v] of CACHE) if (!freshCopy(v)) CACHE.delete(k)
    CACHE.set(key, { ts: Date.now(), payload, ttl })
    return Response.json(payload, { headers: cdnHeaders(ttl / 1000) })
  }

  // Every Open-Meteo source gave nothing, each request asked twice (lib/weather.js tfetch): the place's
  // last full blend, at most 2 hours old, goes out instead of a thin one, with the time it was made
  // (generatedAt, and kept). Vienna, 2026-11-13: one 503 on all four requests, 5 sources for 2 minutes.
  // Nothing of this build is stored then: the thin blend is not what the visitor got. Counted either
  // way (error_log, scope forecast.lost): /api/health reports more than a few in 15 minutes.
  const place = placeKey(geo.lat, geo.lon)
  if (lostOpenMeteo(failed)) {
    const kept = await lastAnswer('forecast', place)
    await logError('forecast.lost', new Error(kept ? 'every Open-Meteo source lost: the last full blend served' : 'every Open-Meteo source lost: thin blend, no full one kept'), { city: geo.name, kept: kept?.madeAt ?? null, limited })
    if (kept) return send({ ...kept.body, ...(await named()), kept: kept.madeAt }) // the request's fields last: they win
  }

  // 3. Region-specific weights, falling back to global
  const { data: regionWeights, error: rwErr } = await supabase
    .from('api_weights')
    .select('id, weight, delta_history')
    .eq('region', region)

  let weightRows = (!rwErr && regionWeights?.length) ? regionWeights.filter(w => !isRetired(w.id) && covers(w.id, region)) : null

  if (!weightRows) {
    const { data: globalWeights } = await supabase
      .from('api_weights')
      .select('id, weight, delta_history')
    weightRows = (globalWeights ?? []).filter(w => !isRetired(w.id) && covers(w.id, region))
  }

  // 4. Gewichteten Durchschnitt berechnen
  const { consensus, warning, weights: weightMap, rainingNow } = blendNow(results, weightRows)

  // the weather now as most sources say it — the same words the page shows
  const mainCondition = heroCondition({ sources: results })

  // MetaBlend Local — our own prognostic: the live consensus corrected by the
  // per-city bias learned from user feedback and station calibration
  // (lib/blend.js). Added AFTER the consensus/confidence/warning math so it
  // never feeds back into the number it derives from; stored and scored like
  // any other source so the leaderboard shows if it earns its keep.
  const learnCity = await learnCityP
  const bias = await getCityBias(learnCity, isNightAt(geo.lon))
  if (bias != null) {
    results.push({
      apiId: 'metablend',
      displayName: 'MetaBlend Local',
      temp: Math.round((consensus.temp + bias) * 10) / 10,
      feelsLike: Math.round((consensus.feelsLike + bias) * 10) / 10,
      rainPct: consensus.rainPct,
      rainIsProb: consensus.rainPct != null,
      windKmh: consensus.windKmh,
      condition: mainCondition,
      synthetic: true,
    })
  }

  // 5. Prognosen speichern — tagged with the city's local date, so daily
  // calibration compares them against the right day's actuals
  const today = localDateForLon(geo.lon)
  const { error: fcInsErr } = await supabase.from('forecasts').insert(
    results.map(r => ({
      city:      learnCity,
      lat:       geo.lat,
      lon:       geo.lon,
      api_id:    r.apiId,
      valid_for: today,
      temp:      r.temp,
      rain_pct:  r.rainPct,
      wind_kmh:  r.windKmh,
      condition: r.condition,
      region,
    }))
  )
  // Don't fail the request over history storage, but don't swallow it silently
  // either — a broken insert here is why calibration had no data to learn from.
  if (fcInsErr) logError('forecast.insert', fcInsErr, { city: learnCity })

  // snapshot the consensus for the RSS feed and the low-confidence webhook
  {
    const { error } = await supabase.from('consensus_history').insert({
      city: learnCity,
      country: geo.country,
      region,
      temp: consensus.temp,
      feels_like: consensus.feelsLike,
      rain_pct: consensus.rainPct,
      wind_kmh: consensus.windKmh,
      confidence_pct: consensus.confidencePct,
      condition: mainCondition,
      source_count: results.length,
    })
    if (error) logError('forecast.history', error, { city: learnCity })
  }

  // Low-confidence consensus → the webhook check, after the response (and
  // only when there's a webhook to call). Cleanup is a daily cron, not here.
  if (consensus.confidencePct < 40 && process.env.WEBHOOK_URL) {
    const origin = selfBase(request)
    const jobHeaders = process.env.CRON_SECRET
      ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      : undefined
    after(() => fetch(`${origin}/api/webhook`, { headers: jobHeaders }).catch(() => {}))
  }

  // the blend itself: the same for every request of the place, no text from the request in it
  const blend = {
    consensus,
    sources:  publicSources([...results, ...downSources]), // blended above with every value; public without the ones a licence keeps private
    weights:  weightMap,
    // how each source has done lately: ranks the website's "Trusted most" list
    recentScores: Object.fromEntries(weightRows.map(w => [w.id, recentMean(w.delta_history)]).filter(([, v]) => v != null)),
    extras,
    details,
    yesterdayTemp: yesterdayTemp ?? null,
    warning,
    rainingNow,
    partial: failed.length > 0, // a source that was asked gave nothing: fewer sources than usual
    generatedAt: new Date().toISOString(),
  }
  // a full blend is kept for the place, without the request's fields (lib/last-answer.js)
  if (!failed.length) await keepAnswer('forecast', place, blend)
  return send({ ...(await named()), ...blend })
})

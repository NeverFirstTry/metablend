import { supabase } from '@/lib/supabase'
import { withErrorLog, logError } from '@/lib/log'
import { clientIp, isInternal, selfBase } from '@/lib/auth'
import { pickLang } from '@/lib/share'
import { parseNear } from '@/lib/geo'
import {
  geocodeCity, learnName, getRegion,
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchMETNorway, fetchVisualCrossing,
  fetchMeteoFrance, fetchOpenMeteoModels, fetchPirateWeather, fetchGeoSphere,
  fetchECMWF, fetchGFS, fetchICON, fetchNWS, fetchBrightSky, fetchSMHI,
  fetchOpenMeteoExtras, fetchOpenMeteoDetails, fetchYesterdayTemp,
} from '@/lib/weather'
import { getCityBias } from '@/lib/blend'
import { isNightAt, localDateForLon } from '@/lib/localtime'
import { createRateLimiter } from '@/lib/ratelimit'
import { sourceName } from '@/lib/sources'
import { heroCondition } from '@/lib/conditions'

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
// that actually saves upstream quota) and a 15-min in-memory copy per warm
// instance as a second line. Errors are never cached.
const CACHE = new Map()
const CACHE_TTL = 15 * 60 * 1000
const cacheKey = (city, lang, near) => `${city.trim().toLowerCase()}|${lang}|${near ? `${near.lat},${near.lon}` : ''}`
const cdnHeaders = ttlSec => ({ 'Cache-Control': `public, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec * 2}` })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

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
  const cached = CACHE.get(key)
  const age = cached ? Date.now() - cached.ts : Infinity
  if (age < CACHE_TTL) {
    return Response.json({ ...cached.payload, cached: true }, { headers: cdnHeaders(Math.max(1, Math.round((CACHE_TTL - age) / 1000))) })
  }

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
  // the sources; if the lookup fails, the searched name stands in.
  const learnCityP = learnName(geo, lang).then(n => n ?? geo.name)

  // 2. All source APIs in parallel, each timed — plus the extra national and
  // AI models, which come in one shared Open-Meteo request
  const [timed, models] = await Promise.all([Promise.all([
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
  ]), timedFetch('open-meteo-models', () => fetchOpenMeteoModels(geo.lat, geo.lon))])

  const [extras, details, yesterdayTemp] = await Promise.all([
    fetchOpenMeteoExtras(geo.lat, geo.lon),
    fetchOpenMeteoDetails(geo.lat, geo.lon),
    fetchYesterdayTemp(geo.lat, geo.lon),
  ])

  // successful sources, tagged with their response time
  const results = timed
    .filter(t => t.value !== null)
    .map(t => ({ ...t.value, responseMs: t.ms }))
    .concat((models.value ?? []).map(v => ({ ...v, responseMs: models.ms })))

  // sources that actively failed (threw / timed out) — shown as "down"
  const downSources = timed
    .filter(t => t.down)
    .map(t => ({ apiId: t.id, displayName: sourceName(t.id), down: true, responseMs: t.ms }))

  if (results.length === 0) return noStore({ error: 'No API data available' }, 500)

  // 3. Region-specific weights, falling back to global
  const { data: regionWeights, error: rwErr } = await supabase
    .from('api_weights')
    .select('id, weight')
    .eq('region', region)

  let weightRows = (!rwErr && regionWeights?.length) ? regionWeights : null

  if (!weightRows) {
    const { data: globalWeights } = await supabase
      .from('api_weights')
      .select('id, weight')
    weightRows = globalWeights ?? []
  }

  const weightMap = {}
  weightRows.forEach(w => { weightMap[w.id] = w.weight })

  // 4. Gewichteten Durchschnitt berechnen
  // Rain is averaged only across sources reporting a true precipitation
  // probability (rainIsProb) — cloud cover / humidity stand-ins used to bias
  // the answer toward "rain". MET Norway/GeoSphere pseudo-probabilities serve as a
  // fallback when no real probability source responded.
  let totalWeight = 0
  let wTemp = 0, wFeelsLike = 0, wWind = 0
  let rainSum = 0, rainWeight = 0

  results.forEach(r => {
    const w = weightMap[r.apiId] ?? 0.25
    wTemp      += r.temp                   * w
    wFeelsLike += (r.feelsLike ?? r.temp)  * w
    wWind      += r.windKmh                * w
    totalWeight += w
    if (r.rainIsProb && r.rainPct != null) { rainSum += r.rainPct * w; rainWeight += w }
  })
  if (!rainWeight) {
    results.forEach(r => {
      if (r.rainPct == null) return
      const w = weightMap[r.apiId] ?? 0.25
      rainSum += r.rainPct * w; rainWeight += w
    })
  }

  const consensus = {
    temp:      Math.round((wTemp      / totalWeight) * 10) / 10,
    feelsLike: Math.round((wFeelsLike / totalWeight) * 10) / 10,
    rainPct:   rainWeight ? Math.round(rainSum / rainWeight) : null,
    windKmh:   Math.round( wWind      / totalWeight),
  }

  const temps = results.map(r => r.temp)
  const std = Math.sqrt(temps.reduce((s, t) => s + (t - consensus.temp) ** 2, 0) / temps.length)
  consensus.confidencePct = Math.max(0, Math.min(100, Math.round(100 - std * 12)))

  // warn only when everyone agrees it's nasty — judged on real rain
  // probabilities only, so a humid overcast day can't trip the alarm
  const STORM = /thunder|storm|gewitter|orage|tormenta|temporale/i
  const probSources = results.filter(r => r.rainIsProb && r.rainPct != null)
  const allHeavyRain = probSources.length >= 2 && probSources.every(r => r.rainPct > 80)
  const allStorm = results.length >= 2 && results.every(r => STORM.test(r.condition ?? ''))
  const warning = (allHeavyRain || allStorm)
    ? { active: true, type: allStorm ? 'thunderstorm' : 'heavy_rain' }
    : { active: false }

  // Sources without a probability feed still say things: an explicit rain /
  // snow / thunder condition is an observation, not the cloud-cover stand-in
  // that rainIsProb guards against. Their share works as an ensemble vote
  // that floors the probability — "3 sources report rain" must never
  // coexist with a single-digit rain number. null stays reserved for "no
  // rain data at all". (The rain *verdict* for the hours ahead is the
  // outlook's 48 h headline now.)
  const PRECIP = /rain|drizzle|shower|sleet|snow|hail|thunder|storm/i
  const reporting = results.filter(r => r.condition)
  const rainingNow = reporting.filter(r => PRECIP.test(r.condition))
  if (reporting.length >= 3 && rainingNow.length) {
    const vote = Math.round((rainingNow.length / reporting.length) * 100)
    if (consensus.rainPct == null || vote > consensus.rainPct) consensus.rainPct = vote
  }

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

  // Response-time + uptime stats (EMA on the response time, running up/down
  // counts), atomic via the bump_api_stats DB function.
  const attempts = timed.filter(t => t.value !== null || t.down)
  if (attempts.length) {
    const { error: rpcErr } = await supabase.rpc('bump_api_stats', {
      rows: attempts.map(t => ({ api_id: t.id, ms: t.ms, up: t.value !== null })),
    })
    if (rpcErr) logError('forecast.stats', rpcErr)
  }

  // Low-confidence consensus → fire the webhook check in the background.
  // (Cleanup is NOT triggered here anymore — it's a daily cron; running two
  // table-scan deletes per cache-miss search was pure overhead.)
  if (consensus.confidencePct < 40) {
    const origin = selfBase(request)
    const jobHeaders = process.env.CRON_SECRET
      ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      : undefined
    fetch(`${origin}/api/webhook`, { headers: jobHeaders }).catch(() => {})
  }

  const payload = {
    city:     geo.name,
    learnCity, // the key feedback reports are matched by (see above)
    country:  geo.country,
    lat:      geo.lat,
    lon:      geo.lon,
    region,
    consensus,
    sources:  [...results, ...downSources],
    weights:  weightMap,
    extras,
    details,
    yesterdayTemp: yesterdayTemp ?? null,
    warning,
    rainingNow: { count: rainingNow.length, total: reporting.length },
    generatedAt: new Date().toISOString(),
  }

  CACHE.set(key, { ts: Date.now(), payload })
  return Response.json(payload, { headers: cdnHeaders(CACHE_TTL / 1000) })
})

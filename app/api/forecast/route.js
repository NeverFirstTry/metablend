import { supabase } from '@/lib/supabase'
import { withErrorLog, logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import {
  geocodeCity, getRegion,
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchTomorrow, fetchMETNorway, fetchVisualCrossing,
  fetchWorldWeatherOnline, fetchWeatherStack, fetchNASAPOWER, fetchGeoSphere,
  fetchECMWF, fetchGFS, fetchICON, fetchNWS, fetchBrightSky, fetchSMHI,
  fetchOpenMeteoExtras, fetchOpenMeteoDetails, fetchYesterdayTemp,
} from '@/lib/weather'
import { getCityBias } from '@/lib/blend'
import { isNightAt, localDateForLon } from '@/lib/localtime'
import { createRateLimiter } from '@/lib/ratelimit'
import { sourceName } from '@/lib/sources'

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
const cacheKey = (city, lang) => `${city.trim().toLowerCase()}|${lang}`
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
  const lang = searchParams.get('lang') ?? 'en'

  if (!city) return noStore({ error: 'No city specified' }, 400)

  // serve a fresh in-memory copy if we have one — the CDN may keep it only
  // for what's left of its 15 minutes
  const key = cacheKey(city, lang)
  const cached = CACHE.get(key)
  const age = cached ? Date.now() - cached.ts : Infinity
  if (age < CACHE_TTL) {
    return Response.json({ ...cached.payload, cached: true }, { headers: cdnHeaders(Math.max(1, Math.round((CACHE_TTL - age) / 1000))) })
  }

  // Cache miss → this request will hit the metered upstream APIs, so throttle.
  if (limiter.limited(clientIp(request))) {
    return noStore({ error: 'Too many requests — please slow down.' }, 429)
  }

  // 1. Stadt → Koordinaten
  const geo = await geocodeCity(city, lang)
  if (!geo) {
    return noStore({ error: `"${city}" was not found. Check the spelling or pick a city from the suggestions.` }, 404)
  }

  const region = getRegion(geo.lat, geo.lon)

  // 2. All source APIs in parallel, each timed
  const timed = await Promise.all([
    timedFetch('open-meteo',           () => fetchOpenMeteo(geo.lat, geo.lon)),
    timedFetch('owm',                  () => fetchOWM(geo.lat, geo.lon)),
    timedFetch('weatherapi',           () => fetchWeatherAPI(geo.lat, geo.lon)),
    timedFetch('tomorrow',             () => fetchTomorrow(geo.lat, geo.lon)),
    timedFetch('met-norway',           () => fetchMETNorway(geo.lat, geo.lon)),
    timedFetch('visual-crossing',      () => fetchVisualCrossing(geo.lat, geo.lon)),
    timedFetch('world-weather-online', () => fetchWorldWeatherOnline(geo.lat, geo.lon)),
    timedFetch('weatherstack',         () => fetchWeatherStack(geo.lat, geo.lon)),
    timedFetch('nasa-power',           () => fetchNASAPOWER(geo.lat, geo.lon)),
    timedFetch('geosphere',            () => fetchGeoSphere(geo.lat, geo.lon)),
    timedFetch('ecmwf',                () => fetchECMWF(geo.lat, geo.lon)),
    timedFetch('gfs',                  () => fetchGFS(geo.lat, geo.lon)),
    timedFetch('icon',                 () => fetchICON(geo.lat, geo.lon)),
    timedFetch('nws',                  () => fetchNWS(geo.lat, geo.lon)),
    timedFetch('brightsky',            () => fetchBrightSky(geo.lat, geo.lon)),
    timedFetch('smhi',                 () => fetchSMHI(geo.lat, geo.lon)),
  ])

  const [extras, details, yesterdayTemp] = await Promise.all([
    fetchOpenMeteoExtras(geo.lat, geo.lon),
    fetchOpenMeteoDetails(geo.lat, geo.lon),
    fetchYesterdayTemp(geo.lat, geo.lon),
  ])

  // successful sources, tagged with their response time
  const results = timed
    .filter(t => t.value !== null)
    .map(t => ({ ...t.value, responseMs: t.ms }))

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
  // the answer toward "rain". NASA/GeoSphere pseudo-probabilities serve as a
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

  const mainCondition = results.find(r => r.apiId === 'open-meteo')?.condition ?? results[0]?.condition ?? null

  // MetaBlend Local — our own prognostic: the live consensus corrected by the
  // per-city bias learned from user feedback and station calibration
  // (lib/blend.js). Added AFTER the consensus/confidence/warning math so it
  // never feeds back into the number it derives from; stored and scored like
  // any other source so the leaderboard shows if it earns its keep.
  const bias = await getCityBias(geo.name, isNightAt(geo.lon))
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
      city:      geo.name,
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
  if (fcInsErr) logError('forecast.insert', fcInsErr, { city: geo.name })

  // snapshot the consensus for the RSS feed and the low-confidence webhook
  try {
    await supabase.from('consensus_history').insert({
      city: geo.name,
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
  } catch { /* table may not exist yet */ }

  // Response-time + uptime stats (EMA on the response time, running up/down
  // counts). Atomic via the bump_api_stats DB function; falls back to the old
  // read-modify-write (which can drop concurrent increments) on DBs that
  // haven't re-run setup_all.sql yet.
  try {
    const attempts = timed.filter(t => t.value !== null || t.down)
    if (attempts.length) {
      const { error: rpcErr } = await supabase.rpc('bump_api_stats', {
        rows: attempts.map(t => ({ api_id: t.id, ms: t.ms, up: t.value !== null })),
      })
      if (rpcErr) {
        const { data: existing } = await supabase
          .from('api_stats')
          .select('api_id, avg_response_ms, success_count, fail_count')
        const cur = {}
        ;(existing ?? []).forEach(r => { cur[r.api_id] = r })
        const rows = attempts.map(t => {
          const prev = cur[t.id]
          const up = t.value !== null
          const avg = prev?.avg_response_ms != null
            ? Math.round(prev.avg_response_ms * 0.7 + t.ms * 0.3)
            : t.ms
          return {
            api_id: t.id,
            avg_response_ms: avg,
            success_count: (prev?.success_count ?? 0) + (up ? 1 : 0),
            fail_count: (prev?.fail_count ?? 0) + (up ? 0 : 1),
            last_checked: new Date().toISOString(),
          }
        })
        await supabase.from('api_stats').upsert(rows, { onConflict: 'api_id' })
      }
    }
  } catch { /* api_stats table may not exist yet */ }

  // Low-confidence consensus → fire the webhook check in the background.
  // (Cleanup is NOT triggered here anymore — it's a daily cron; running two
  // table-scan deletes per cache-miss search was pure overhead.)
  if (consensus.confidencePct < 40) {
    const origin = new URL(request.url).origin
    const jobHeaders = process.env.CRON_SECRET
      ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      : undefined
    fetch(`${origin}/api/webhook`, { headers: jobHeaders }).catch(() => {})
  }

  const payload = {
    city:     geo.name,
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

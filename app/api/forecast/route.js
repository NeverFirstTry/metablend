import { supabase } from '@/lib/supabase'
import { withErrorLog, logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import {
  geocodeCity, getRegion, localDateForLon,
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchTomorrow, fetchMETNorway, fetchVisualCrossing,
  fetchWorldWeatherOnline, fetchWeatherStack, fetchNASAPOWER, fetchGeoSphere,
  fetchOpenMeteoForecast, fetchOpenMeteoExtras, fetchOpenMeteoHourly,
  fetchOpenMeteoDetails, fetchMonthHistory, fetchYesterdayTemp,
} from '@/lib/weather'

const DISPLAY_NAMES = {
  'open-meteo': 'Open-Meteo', owm: 'OpenWeatherMap', weatherapi: 'WeatherAPI',
  tomorrow: 'Tomorrow.io', 'met-norway': 'MET Norway', 'visual-crossing': 'Visual Crossing',
  'world-weather-online': 'World Weather Online', weatherstack: 'Weatherstack', 'nasa-power': 'NASA POWER',
  geosphere: 'GeoSphere Austria',
}

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

// 15-min in-memory cache, keyed by city+lang. Lives as long as the warm
// instance does; cold starts just re-fetch.
const CACHE = new Map()
const CACHE_TTL = 15 * 60 * 1000
const cacheKey = (city, lang) => `${city.trim().toLowerCase()}|${lang}`

// Per-IP throttle on the expensive (cache-miss) path so nobody can drain the
// metered upstream weather APIs by spamming distinct cities. In-memory and
// best-effort (per warm instance, resets on cold start) — enough to stop casual
// abuse without a datastore. Cache hits below are free and never counted.
const RATE = new Map()
const RATE_MAX = 40             // cache-miss forecasts …
const RATE_WINDOW = 60 * 1000   // … per minute, per IP
function forecastRateLimited(ip) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.resetAt) {
    // occasionally sweep expired IPs so the map doesn't grow unbounded
    if (RATE.size > 1000) {
      for (const [k, v] of RATE) if (now > v.resetAt) RATE.delete(k)
    }
    RATE.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return false
  }
  e.count += 1
  return e.count > RATE_MAX
}

export const GET = withErrorLog('forecast', async (request) => {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')
  const lang = searchParams.get('lang') ?? 'en'

  if (!city) {
    return Response.json({ error: 'No city specified' }, { status: 400 })
  }

  // serve a fresh cached copy if we have one
  const key = cacheKey(city, lang)
  const cached = CACHE.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Response.json({ ...cached.payload, cached: true })
  }

  // Cache miss → this request will hit the metered upstream APIs, so throttle.
  if (forecastRateLimited(clientIp(request))) {
    return Response.json({ error: 'Too many requests — please slow down.' }, { status: 429 })
  }

  // 1. Stadt → Koordinaten
  const geo = await geocodeCity(city, lang)
  if (!geo) {
    return Response.json({
      error: `"${city}" was not found. Check the spelling or pick a city from the suggestions.`,
    }, { status: 404 })
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
  ])

  const [{ days: forecast7, sunrise, sunset }, extras, hourly, details, history, yesterdayTemp] = await Promise.all([
    fetchOpenMeteoForecast(geo.lat, geo.lon),
    fetchOpenMeteoExtras(geo.lat, geo.lon),
    fetchOpenMeteoHourly(geo.lat, geo.lon),
    fetchOpenMeteoDetails(geo.lat, geo.lon),
    fetchMonthHistory(geo.lat, geo.lon),
    fetchYesterdayTemp(geo.lat, geo.lon),
  ])

  // climate normals for the current month (today-vs-average is computed client-side)
  const climate = history
    ? { month: history.month, years: history.years, avgTemp: history.avgTemp, avgRainyDays: history.avgRainyDays }
    : null

  // successful sources, tagged with their response time
  const results = timed
    .filter(t => t.value !== null)
    .map(t => ({ ...t.value, responseMs: t.ms }))

  // sources that actively failed (threw / timed out) — shown as "down"
  const downSources = timed
    .filter(t => t.down)
    .map(t => ({ apiId: t.id, displayName: DISPLAY_NAMES[t.id] ?? t.id, down: true, responseMs: t.ms }))

  if (results.length === 0) {
    return Response.json({ error: 'No API data available' }, { status: 500 })
  }

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

  const willRain = consensus.rainPct == null ? null : consensus.rainPct >= 40
  const bestTime = hourly?.best ?? null

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

  // snapshot the consensus for the RSS feed + intraday history chart
  const mainCondition = results.find(r => r.apiId === 'open-meteo')?.condition ?? results[0]?.condition ?? null
  let historyToday = []
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
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const { data: hist } = await supabase
      .from('consensus_history')
      .select('temp, created_at')
      .ilike('city', geo.name)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: true })
    historyToday = (hist ?? []).map(h => ({ temp: h.temp, t: h.created_at }))
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
    forecast7,
    sunrise,
    sunset,
    extras,
    details,
    climate,
    records:  history?.records ?? null,
    yesterdayTemp: yesterdayTemp ?? null,
    historyToday,
    warning,
    willRain,
    bestTime,
  }

  CACHE.set(key, { ts: Date.now(), payload })
  return Response.json(payload)
})

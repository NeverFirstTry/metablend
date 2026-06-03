import { supabase } from '@/lib/supabase'
import {
  geocodeCity, getRegion,
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchTomorrow, fetchMETNorway, fetchVisualCrossing,
  fetchWorldWeatherOnline, fetchWeatherStack, fetchNASAPOWER,
  fetchOpenMeteoForecast, fetchOpenMeteoExtras, fetchOpenMeteoHourly,
} from '@/lib/weather'

// ── In-memory response cache (15 min) ─────────────────────────────────────────
// Keyed by normalised city + language. Survives between requests on a warm
// serverless instance; cold starts simply re-fetch, which is fine.
const CACHE = new Map()
const CACHE_TTL = 15 * 60 * 1000

function cacheKey(city, lang) {
  return `${city.trim().toLowerCase()}|${lang}`
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')
  const lang = searchParams.get('lang') ?? 'en'

  if (!city) {
    return Response.json({ error: 'No city specified' }, { status: 400 })
  }

  // 0. Serve from cache if fresh
  const key = cacheKey(city, lang)
  const cached = CACHE.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Response.json({ ...cached.payload, cached: true })
  }

  // 1. Stadt → Koordinaten
  const geo = await geocodeCity(city, lang)
  if (!geo) {
    return Response.json({
      error: `"${city}" was not found. Check the spelling or pick a city from the suggestions.`,
    }, { status: 404 })
  }

  const region = getRegion(geo.lat, geo.lon)

  // 2. Alle APIs parallel abfragen
  const [
    openMeteo, owm, weatherApi, tomorrow, metNorway,
    visualCrossing, worldWeather, weatherStack, nasaPower,
  ] = await Promise.allSettled([
    fetchOpenMeteo(geo.lat, geo.lon),
    fetchOWM(geo.lat, geo.lon),
    fetchWeatherAPI(geo.lat, geo.lon),
    fetchTomorrow(geo.lat, geo.lon),
    fetchMETNorway(geo.lat, geo.lon),
    fetchVisualCrossing(geo.lat, geo.lon),
    fetchWorldWeatherOnline(geo.lat, geo.lon),
    fetchWeatherStack(geo.lat, geo.lon),
    fetchNASAPOWER(geo.lat, geo.lon),
  ])

  const [{ days: forecast7, sunrise, sunset }, extras, hourly] = await Promise.all([
    fetchOpenMeteoForecast(geo.lat, geo.lon),
    fetchOpenMeteoExtras(geo.lat, geo.lon),
    fetchOpenMeteoHourly(geo.lat, geo.lon),
  ])

  const results = [openMeteo, owm, weatherApi, tomorrow, metNorway, visualCrossing, worldWeather, weatherStack, nasaPower]
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)

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
  let totalWeight = 0
  let wTemp = 0, wFeelsLike = 0, wRain = 0, wWind = 0

  results.forEach(r => {
    const w = weightMap[r.apiId] ?? 0.25
    wTemp      += r.temp                   * w
    wFeelsLike += (r.feelsLike ?? r.temp)  * w
    wRain      += r.rainPct                * w
    wWind      += r.windKmh                * w
    totalWeight += w
  })

  const consensus = {
    temp:      Math.round((wTemp      / totalWeight) * 10) / 10,
    feelsLike: Math.round((wFeelsLike / totalWeight) * 10) / 10,
    rainPct:   Math.round( wRain      / totalWeight),
    windKmh:   Math.round( wWind      / totalWeight),
  }

  const temps = results.map(r => r.temp)
  const std = Math.sqrt(temps.reduce((s, t) => s + (t - consensus.temp) ** 2, 0) / temps.length)
  consensus.confidencePct = Math.max(0, Math.min(100, Math.round(100 - std * 12)))

  // 4b. Severe-weather warning: all sources agree on heavy rain / thunderstorm
  const STORM = /thunder|storm|gewitter|orage|tormenta|temporale/i
  const allHeavyRain = results.length >= 2 && results.every(r => r.rainPct > 80)
  const allStorm = results.length >= 2 && results.every(r => STORM.test(r.condition ?? ''))
  const warning = (allHeavyRain || allStorm)
    ? { active: true, type: allStorm ? 'thunderstorm' : 'heavy_rain' }
    : { active: false }

  // 4c. Simple rain answer (consensus threshold 40 %)
  const willRain = consensus.rainPct >= 40

  // 4d. Best time of day for outdoor activities
  const bestTime = hourly?.best
    ? { hour: hourly.best.hour, time: hourly.best.time, temp: hourly.best.temp, rainPct: hourly.best.rainPct, windKmh: hourly.best.windKmh, icon: hourly.best.icon }
    : null

  // 5. Prognosen speichern
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('forecasts').insert(
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

  // Cleanup in background
  fetch(`${new URL(request.url).origin}/api/cleanup`).catch(() => {})

  const payload = {
    city:     geo.name,
    country:  geo.country,
    lat:      geo.lat,
    lon:      geo.lon,
    region,
    consensus,
    sources:  results,
    weights:  weightMap,
    forecast7,
    sunrise,
    sunset,
    extras,
    warning,
    willRain,
    bestTime,
  }

  // Store in the 15-minute cache
  CACHE.set(key, { ts: Date.now(), payload })

  return Response.json(payload)
}

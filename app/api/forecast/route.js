import { supabase } from '@/lib/supabase'
import {
  geocodeCity, getRegion,
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchTomorrow, fetchMETNorway, fetchVisualCrossing,
  fetchWorldWeatherOnline, fetchWeatherStack, fetchNASAPOWER,
  fetchOpenMeteoForecast, fetchOpenMeteoExtras, fetchOpenMeteoHourly,
  fetchOpenMeteoDetails, fetchMonthHistory,
} from '@/lib/weather'

// 15-min in-memory cache, keyed by city+lang. Lives as long as the warm
// instance does; cold starts just re-fetch.
const CACHE = new Map()
const CACHE_TTL = 15 * 60 * 1000
const cacheKey = (city, lang) => `${city.trim().toLowerCase()}|${lang}`

export async function GET(request) {
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

  const [{ days: forecast7, sunrise, sunset }, extras, hourly, details, history] = await Promise.all([
    fetchOpenMeteoForecast(geo.lat, geo.lon),
    fetchOpenMeteoExtras(geo.lat, geo.lon),
    fetchOpenMeteoHourly(geo.lat, geo.lon),
    fetchOpenMeteoDetails(geo.lat, geo.lon),
    fetchMonthHistory(geo.lat, geo.lon),
  ])

  // climate normals for the current month (today-vs-average is computed client-side)
  const climate = history
    ? { month: history.month, years: history.years, avgTemp: history.avgTemp, avgRainyDays: history.avgRainyDays }
    : null

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

  // warn only when everyone agrees it's nasty
  const STORM = /thunder|storm|gewitter|orage|tormenta|temporale/i
  const allHeavyRain = results.length >= 2 && results.every(r => r.rainPct > 80)
  const allStorm = results.length >= 2 && results.every(r => STORM.test(r.condition ?? ''))
  const warning = (allHeavyRain || allStorm)
    ? { active: true, type: allStorm ? 'thunderstorm' : 'heavy_rain' }
    : { active: false }

  const willRain = consensus.rainPct >= 40
  const bestTime = hourly?.best ?? null

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

  // snapshot the consensus for the RSS feed + intraday history chart
  const mainCondition = results.find(r => r.apiId === 'open-meteo')?.condition ?? results[0]?.condition ?? null
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
  }).then(() => {}, () => {}) // table may not exist yet — don't block the response

  // Cleanup in background
  const origin = new URL(request.url).origin
  fetch(`${origin}/api/cleanup`).catch(() => {})

  // Low-confidence consensus → fire the webhook check in the background
  if (consensus.confidencePct < 40) {
    fetch(`${origin}/api/webhook`).catch(() => {})
  }

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
    details,
    climate,
    warning,
    willRain,
    bestTime,
  }

  CACHE.set(key, { ts: Date.now(), payload })
  return Response.json(payload)
}

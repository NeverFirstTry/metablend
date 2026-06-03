import { supabase } from '@/lib/supabase'
import {
  geocodeCity, getRegion,
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchTomorrow, fetchMETNorway, fetchVisualCrossing,
  fetchOpenMeteoForecast,
} from '@/lib/weather'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')
  const lang = searchParams.get('lang') ?? 'en'

  if (!city) {
    return Response.json({ error: 'No city specified' }, { status: 400 })
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
  const [openMeteo, owm, weatherApi, tomorrow, metNorway, visualCrossing] = await Promise.allSettled([
    fetchOpenMeteo(geo.lat, geo.lon),
    fetchOWM(geo.lat, geo.lon),
    fetchWeatherAPI(geo.lat, geo.lon),
    fetchTomorrow(geo.lat, geo.lon),
    fetchMETNorway(geo.lat, geo.lon),
    fetchVisualCrossing(geo.lat, geo.lon),
  ])

  const { days: forecast7, sunrise, sunset } = await fetchOpenMeteoForecast(geo.lat, geo.lon)

  const results = [openMeteo, owm, weatherApi, tomorrow, metNorway, visualCrossing]
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

  return Response.json({
    city:     geo.name,
    country:  geo.country,
    region,
    consensus,
    sources:  results,
    weights:  weightMap,
    forecast7,
    sunrise,
    sunset,
  })
}

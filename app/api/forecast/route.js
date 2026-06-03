import { supabase } from '@/lib/supabase'
import { geocodeCity, fetchOpenMeteo, fetchOWM } from '@/lib/weather'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')

  if (!city) {
    return Response.json({ error: 'Keine Stadt angegeben' }, { status: 400 })
  }

  // 1. Stadt → Koordinaten
  const geo = await geocodeCity(city)
  if (!geo) {
    return Response.json({ error: 'Stadt nicht gefunden' }, { status: 404 })
  }

  // 2. Alle APIs parallel abfragen
  const [openMeteo, owm] = await Promise.allSettled([
    fetchOpenMeteo(geo.lat, geo.lon),
    fetchOWM(geo.lat, geo.lon),
  ])

  const results = [openMeteo, owm]
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)

  if (results.length === 0) {
    return Response.json({ error: 'Keine API-Daten verfügbar' }, { status: 500 })
  }

  // 3. Gewichtungen aus Supabase laden
  const { data: weights, error: wError } = await supabase
  .from('api_weights')
  .select('id, weight, name')

console.log('weights:', weights)
console.log('error:', wError)

  const weightMap = {}
  weights?.forEach(w => weightMap[w.id] = w.weight)

  // 4. Gewichteten Durchschnitt berechnen
  let totalWeight = 0
  let wTemp = 0, wRain = 0, wWind = 0

  results.forEach(r => {
    const w = weightMap[r.apiId] ?? 0.25
    wTemp  += r.temp    * w
    wRain  += r.rainPct * w
    wWind  += r.windKmh * w
    totalWeight += w
  })

  const consensus = {
    temp:    Math.round((wTemp  / totalWeight) * 10) / 10,
    rainPct: Math.round( wRain  / totalWeight),
    windKmh: Math.round( wWind  / totalWeight),
  }

  // Standardabweichung → Konsens-Score
  const temps = results.map(r => r.temp)
  const std = Math.sqrt(temps.reduce((s, t) => s + (t - consensus.temp) ** 2, 0) / temps.length)
  consensus.confidencePct = Math.max(0, Math.min(100, Math.round(100 - std * 12)))

  // 5. Prognosen in Supabase speichern (für späteres Feedback)
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('forecasts').insert(
    results.map(r => ({
      city:       geo.name,
      lat:        geo.lat,
      lon:        geo.lon,
      api_id:     r.apiId,
      valid_for:  today,
      temp:       r.temp,
      rain_pct:   r.rainPct,
      wind_kmh:   r.windKmh,
      condition:  r.condition,
    }))
  )

  return Response.json({
    city:      geo.name,
    country:   geo.country,
    consensus,
    sources:   results,
    weights:   weightMap,
  })

}

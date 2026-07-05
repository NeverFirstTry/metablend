import { supabase } from '@/lib/supabase'
import { median, deltaFromDiff } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { withErrorLog } from '@/lib/log'

// Ground-truth calibration from Weather Underground Personal Weather Stations.
// For each city we have a recent forecast for, find PWS within 10 km, take the
// median of their live temperatures as the actual, and re-weight every API's
// stored forecast against it — same delta/normalization the feedback route uses.
// Meant to run hourly via an external scheduler (GitHub Action).

// Up to 15 cities × (1 lookup + 6 station reads) — needs more than the default.
export const maxDuration = 60

const RADIUS_KM = 10
const LOOKBACK_MIN = 60        // only score forecasts stored in the last hour
const MAX_CITIES = 15          // cap per run to respect Wunderground rate limits
const MAX_STATIONS = 6         // closest N stations per city (median of these)

// Uses the Weather.com PWS API (the current Wunderground endpoint). A key is
// available free to PWS contributors.
async function nearbyStations(lat, lon, key) {
  const url = `https://api.weather.com/v3/location/near?geocode=${lat},${lon}&product=pws&format=json&apiKey=${key}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const loc = (await res.json()).location
    if (!Array.isArray(loc?.stationId)) return []
    // parallel arrays, sorted nearest-first
    return loc.stationId
      .map((id, i) => ({ id, distanceKm: loc.distanceKm?.[i] ?? Infinity }))
      .filter(s => s.distanceKm <= RADIUS_KM)
  } catch {
    return []
  }
}

async function stationTemp(stationId, key) {
  const url = `https://api.weather.com/v2/pws/observations/current?stationId=${encodeURIComponent(stationId)}&format=json&units=m&apiKey=${key}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const t = (await res.json()).observations?.[0]?.metric?.temp
    return typeof t === 'number' ? t : null
  } catch {
    return null
  }
}

export const GET = withErrorLog('station-calibrate', async (request) => {
  // Triggered by an external scheduler (GitHub Action / cron-job.org) rather than
  // a Vercel cron, so gate it behind CALIBRATE_SECRET when one is configured.
  const secret = process.env.CALIBRATE_SECRET
  if (secret) {
    // Header-only — a query param would end up in access/proxy logs.
    const provided =
      request.headers.get('x-calibrate-key') ??
      (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.WUNDERGROUND_KEY
  if (!key) return Response.json({ skipped: 'WUNDERGROUND_KEY not configured' })

  const since = new Date(Date.now() - LOOKBACK_MIN * 60 * 1000).toISOString()
  // Ordered oldest-first so "last row wins" below really is the latest per API.
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, region, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
  if (!forecasts?.length) return Response.json({ skipped: 'no forecasts in the last hour', since })

  // Unique cities (with coordinates), capped
  const seen = new Set()
  const cities = []
  for (const f of forecasts) {
    if (f.lat == null || f.lon == null) continue
    if (!seen.has(f.city) && cities.length < MAX_CITIES) {
      seen.add(f.city)
      cities.push({ city: f.city, lat: f.lat, lon: f.lon, region: f.region ?? 'global' })
    }
  }

  const results = []
  let calibrated = 0

  for (const { city, lat, lon, region } of cities) {
    // 1. Nearby PWS → 2. their live temps (in parallel) → 3. median = ground truth
    const stations = await nearbyStations(lat, lon, key)
    if (!stations.length) { results.push({ city, skipped: 'no PWS within 10km' }); continue }

    const readings = await Promise.all(
      stations.slice(0, MAX_STATIONS).map(s => stationTemp(s.id, key))
    )
    const temps = readings.filter(t => t != null)
    if (!temps.length) { results.push({ city, skipped: 'no station readings' }); continue }
    const actualTemp = median(temps)

    // 4. Latest stored forecast per API for this city (within the lookback window)
    const latestPerApi = {}
    forecasts.filter(f => f.city === city).forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)

    // Cross-API median forecast — used for the outlier guard, same as feedback
    const medForecast = median(unique.map(f => f.temp))

    // 5. Score + re-weight (identical math to the feedback / calibrate routes)
    const deltaMap = {}
    for (const f of unique) {
      deltaMap[f.api_id] = Math.abs(f.temp - medForecast) > 5
        ? -2
        : deltaFromDiff(Math.abs(f.temp - actualTemp), 'instant')
    }

    const applied = await applyDeltas(region, deltaMap)
    if (!applied) continue

    results.push({
      city,
      actualTemp: Math.round(actualTemp * 10) / 10,
      stations: temps.length,
      apis: applied.map(u => ({ id: u.id, delta: u.deltas[0] })),
    })
    calibrated++
  }

  return Response.json({ calibrated, since, radiusKm: RADIUS_KM, results })
})

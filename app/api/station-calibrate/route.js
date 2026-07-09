import { supabase } from '@/lib/supabase'
import { median, deltaFromDiff } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { updateCityBias } from '@/lib/blend'
import { withErrorLog } from '@/lib/log'

// Ground-truth calibration from aviation METAR observations (NOAA Aviation
// Weather Center — free, no key). For each city with a recent forecast, pull
// every METAR in a bounding box around it, take the median temperature of the
// nearest fresh reports as ground truth, and re-weight every API's stored
// forecast against it — same delta/normalization the feedback route uses.
// Replaced Weather Underground PWS, which required a key we never had, so the
// hourly calibration had been silently skipping since launch.

// METARs are prefetched in parallel and weights persist as one batch upsert,
// but 15 cities of DB work still outgrow the default limit (a run 504ed once
// traffic picked up) — give it real headroom.
export const maxDuration = 300

const RADIUS_KM = 60           // METAR stations (airports) are sparser than PWS
const LOOKBACK_MIN = 60        // only score forecasts stored in the last hour
const MAX_CITIES = 15          // cap per run out of courtesy to the free API
const MAX_STATIONS = 4         // nearest N fresh reports (median of these)
const MAX_OBS_AGE_MIN = 90     // METARs are hourly; skip anything staler

function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = d => (d * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}

// Fresh METAR observations within RADIUS_KM of the point, nearest first.
// Returns { temps, winds } — temps in °C, winds in km/h (METAR wspd is knots).
async function metarObs(lat, lon) {
  const bbox = `${(lat - 0.7).toFixed(2)},${(lon - 1.0).toFixed(2)},${(lat + 0.7).toFixed(2)},${(lon + 1.0).toFixed(2)}`
  try {
    const res = await fetch(`https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { temps: [], winds: [] }
    const reports = await res.json()
    if (!Array.isArray(reports)) return { temps: [], winds: [] }
    const cutoff = Date.now() - MAX_OBS_AGE_MIN * 60 * 1000
    const nearest = reports
      .filter(r => typeof r.temp === 'number' && r.lat != null && r.lon != null)
      .filter(r => !r.reportTime || new Date(r.reportTime).getTime() >= cutoff)
      .map(r => ({ ...r, distanceKm: haversineKm(lat, lon, r.lat, r.lon) }))
      .filter(r => r.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_STATIONS)
    return {
      temps: nearest.map(r => r.temp),
      winds: nearest.filter(r => typeof r.wspd === 'number').map(r => r.wspd * 1.852),
    }
  } catch {
    return { temps: [], winds: [] }
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

  const since = new Date(Date.now() - LOOKBACK_MIN * 60 * 1000).toISOString()
  // Ordered oldest-first so "last row wins" below really is the latest per API.
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, wind_kmh, region, created_at')
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

  // The slow network part runs in parallel up front; the DB scoring below
  // stays serial on purpose — cities in the same region touch the same weight
  // rows, and concurrent read-modify-writes would drop deltas.
  const observations = await Promise.all(cities.map(c => metarObs(c.lat, c.lon)))

  for (const [i, { city, lat, lon, region }] of cities.entries()) {
    const { temps, winds } = observations[i]
    if (!temps.length) { results.push({ city, skipped: `no fresh METAR within ${RADIUS_KM}km` }); continue }
    const actualTemp = median(temps)
    const actualWind = winds.length ? median(winds) : null

    // 4. Latest stored forecast per API for this city (within the lookback window)
    const latestPerApi = {}
    forecasts.filter(f => f.city === city).forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)

    // Cross-API median forecast — used for the outlier guard, same as feedback
    const medForecast = median(unique.map(f => f.temp))

    // Teach MetaBlend Local from station ground truth: error of the raw-source
    // median (our own synthetic source excluded) vs the PWS median.
    const real = unique.filter(f => f.api_id !== 'metablend')
    if (real.length) {
      await updateCityBias(city, lat, lon, region, actualTemp - median(real.map(f => f.temp)))
    }

    // 5. Score + re-weight (identical math to the feedback / calibrate routes).
    // Temperature is the primary delta; when both sides report wind, a second
    // delta on the looser 'wind' scheme rewards wind accuracy too.
    const deltaMap = {}
    for (const f of unique) {
      const tempDelta = Math.abs(f.temp - medForecast) > 5
        ? -2
        : deltaFromDiff(Math.abs(f.temp - actualTemp), 'instant')
      const deltas = [tempDelta]
      if (actualWind != null && typeof f.wind_kmh === 'number') {
        deltas.push(deltaFromDiff(Math.abs(f.wind_kmh - actualWind), 'wind'))
      }
      deltaMap[f.api_id] = deltas
    }

    const applied = await applyDeltas(region, deltaMap)
    if (!applied) continue

    results.push({
      city,
      actualTemp: Math.round(actualTemp * 10) / 10,
      actualWind: actualWind != null ? Math.round(actualWind) : null,
      stations: temps.length,
      apis: applied.map(u => ({ id: u.id, deltas: u.deltas })),
    })
    calibrated++
  }

  return Response.json({ calibrated, since, radiusKm: RADIUS_KM, results })
})

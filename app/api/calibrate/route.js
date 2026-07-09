import { supabase } from '@/lib/supabase'
import { deltaFromDiff, median } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { isAuthorizedJob } from '@/lib/auth'

// 50 cities × (one Visual Crossing fetch + weight round-trips) runs well past
// the default serverless limit — give the cron room to finish.
export const maxDuration = 300

// Cap cities per run to stay within the Visual Crossing free tier (~1000 records/day)
const MAX_CITIES = 50

// Actual daily mean temp from Visual Crossing's historical timeline.
async function fetchActualTemp(lat, lon, date, key) {
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/${date}?unitGroup=metric&key=${key}&include=days&elements=datetime,temp`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const t = (await res.json()).days?.[0]?.temp
    return typeof t === 'number' ? t : null
  } catch {
    return null
  }
}

// Daily auto-calibration: score yesterday's forecasts against the real weather
// and re-weight the APIs — same scoring math as the feedback route, but with
// the 'daily' thresholds since an instantaneous forecast is being compared
// against a 24-hour mean (exactly like the Meteostat validation).
export async function GET(request) {
  if (!isAuthorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.VISUAL_CROSSING_KEY
  if (!key) return Response.json({ skipped: 'VISUAL_CROSSING_KEY not configured' })

  // Forecast rows are tagged with the CITY's local date, and Visual Crossing
  // interprets a plain date at the queried coordinates as local too — so
  // scoring "yesterday" compares each city against its own local day.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  // Don't calibrate the same day twice (sentinel row ages out via cleanup)
  const { data: sentinel } = await supabase
    .from('feedback')
    .select('id')
    .eq('report_date', yesterday)
    .eq('actual_cond', '__calibrate__')
    .limit(1)
  if (sentinel?.length) return Response.json({ skipped: 'already calibrated', date: yesterday })

  // Ordered oldest-first so "last row wins" below really is the latest per API.
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, region, created_at')
    .eq('valid_for', yesterday)
    .order('created_at', { ascending: true })
  if (!forecasts?.length) return Response.json({ skipped: 'no forecasts for yesterday', date: yesterday })

  // unique cities, capped
  const seen = new Set()
  const cities = []
  for (const f of forecasts) {
    if (!seen.has(f.city) && cities.length < MAX_CITIES) {
      seen.add(f.city)
      cities.push({ city: f.city, lat: f.lat, lon: f.lon, region: f.region ?? 'global' })
    }
  }

  const results = []
  let calibrated = 0

  for (const { city, lat, lon, region } of cities) {
    const actualTemp = await fetchActualTemp(lat, lon, yesterday, key)
    if (actualTemp == null) { results.push({ city, skipped: 'no Visual Crossing data' }); continue }

    // latest stored forecast per API for this city
    const latestPerApi = {}
    forecasts.filter(f => f.city === city).forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)

    // Median forecast temp across all APIs — used to flag outliers (see below).
    const medianTemp = median(unique.map(f => f.temp))

    const deltaMap = {}
    for (const f of unique) {
      const tempDiff = Math.abs(f.temp - actualTemp)
      // Outlier penalty: an API more than 5°C off the cross-API median gets a
      // hard −2 regardless of how it scored against the actual temp.
      deltaMap[f.api_id] = Math.abs(f.temp - medianTemp) > 5
        ? -2
        : deltaFromDiff(tempDiff, 'daily')
    }

    const applied = await applyDeltas(region, deltaMap)
    if (!applied) continue

    // Mark this city's pending feedback as consumed now that weights are updated.
    await supabase.from('feedback').update({ processed: true }).eq('city', city).eq('processed', false)

    results.push({
      city,
      actualTemp,
      apis: applied.map(u => ({ id: u.id, delta: u.deltas[0] })),
    })
    calibrated++
  }

  // mark this date done
  await supabase.from('feedback').insert({
    city: '__calibrate__',
    actual_temp: 0,
    actual_cond: '__calibrate__',
    report_date: yesterday,
    processed: true,
  })

  return Response.json({ calibrated, date: yesterday, results })
}

import { supabase } from '@/lib/supabase'
import { deltaFromDiff, median } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { isAuthorizedJob } from '@/lib/auth'

// Meteostat lookups + weight round-trips per city can outrun the default limit.
export const maxDuration = 60

// Cap cities per run to respect RapidAPI request limits (~500/month on basic plan)
const MAX_CITIES = 10

// ── Meteostat (RapidAPI) ──────────────────────────────────────────────────────
async function fetchMeteostat(lat, lon, date) {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return null
  const url = `https://meteostat.p.rapidapi.com/point/daily?lat=${lat}&lon=${lon}&start=${date}&end=${date}`
  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'meteostat.p.rapidapi.com',
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.[0] ?? null   // { tavg, tmin, tmax, prcp, wspd, wdir, … }
  } catch {
    return null
  }
}

// ── Historical validation ─────────────────────────────────────────────────────
async function runMeteostatValidation() {
  // Visual Crossing (the 6am /api/calibrate cron) is the primary daily scorer.
  // Only score against Meteostat when VC isn't configured, so each day's
  // forecasts count once — not twice against two different ground truths.
  if (process.env.VISUAL_CROSSING_KEY) {
    return { skipped: 'daily scoring handled by /api/calibrate (Visual Crossing)' }
  }
  if (!process.env.RAPIDAPI_KEY) return { skipped: 'RAPIDAPI_KEY not configured' }

  // valid_for is the city-local date; Meteostat daily data is local too.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  // Guard: a sentinel row in feedback marks "already validated this date"
  const { data: sentinel } = await supabase
    .from('feedback')
    .select('id')
    .eq('report_date', yesterday)
    .eq('actual_cond', '__meteostat__')
    .limit(1)

  if (sentinel?.length) return { skipped: 'already validated', date: yesterday }

  // Fetch all of yesterday's stored forecasts, oldest first so "last row wins"
  // below really is the latest per API.
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, region, created_at')
    .eq('valid_for', yesterday)
    .order('created_at', { ascending: true })

  if (!forecasts?.length) return { skipped: 'no forecasts for yesterday', date: yesterday }

  // Unique cities, capped at MAX_CITIES
  const seenCities = new Set()
  const cities = []
  for (const f of forecasts) {
    if (!seenCities.has(f.city) && cities.length < MAX_CITIES) {
      seenCities.add(f.city)
      cities.push({ city: f.city, lat: f.lat, lon: f.lon, region: f.region ?? 'global' })
    }
  }

  const results = []
  let validated = 0

  for (const { city, lat, lon, region } of cities) {
    // Fetch actual weather from Meteostat
    const actual = await fetchMeteostat(lat, lon, yesterday)
    if (actual?.tavg == null) {   // == null, not falsy — 0°C is a valid average
      results.push({ city, skipped: 'no Meteostat data' })
      continue
    }

    const actualTemp = actual.tavg  // daily average – best single comparison point

    // latest stored forecast per API for this city
    const latestPerApi = {}
    forecasts.filter(f => f.city === city).forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)

    // Median forecast temp across all APIs — used to flag outliers, same as
    // the feedback/calibrate routes.
    const medianTemp = median(unique.map(f => f.temp))

    // Score each API's forecast against the actual daily average.
    // Thresholds are wider than user-feedback (2/4/6/8°) because we're
    // comparing an instantaneous forecast against a 24-h mean.
    const deltaMap = {}
    for (const fc of unique) {
      const diff = Math.abs(fc.temp - actualTemp)
      deltaMap[fc.api_id] = Math.abs(fc.temp - medianTemp) > 5
        ? -2
        : deltaFromDiff(diff, 'daily')
    }

    const applied = await applyDeltas(region, deltaMap)
    if (!applied) continue

    results.push({
      city,
      actualTemp,
      apis: applied.map(u => ({ id: u.id, delta: u.deltas[0] })),
    })
    validated++
  }

  // Insert sentinel so this date isn't validated again (ages out naturally after 48 h)
  await supabase.from('feedback').insert({
    city: '__meteostat__',
    actual_temp: 0,
    actual_cond: '__meteostat__',
    report_date: yesterday,
    processed: true,
  })

  return { validated, date: yesterday, results }
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request) {
  if (!isAuthorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [{ error: fe }, { error: fb }] = await Promise.all([
    supabase.from('forecasts').delete().lt('created_at', cutoff),
    // Only the job sentinels age out. Real community reports stay — they feed
    // the heatmap, which is pointless with a 48-hour memory.
    supabase.from('feedback').delete().lt('created_at', cutoff)
      .in('actual_cond', ['__calibrate__', '__meteostat__']),
  ])

  const validation = await runMeteostatValidation()

  if (fe || fb) {
    return Response.json({ error: fe?.message ?? fb?.message, validation }, { status: 500 })
  }

  return Response.json({ ok: true, cutoff, validation })
}

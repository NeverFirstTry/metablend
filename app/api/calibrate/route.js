import { supabase } from '@/lib/supabase'
import { readAll } from '@/lib/push/paging'
import { dailyDeltas, dayHours } from '@/lib/daily-score'
import { applyDeltas, claimDay } from '@/lib/weights'
import { isAuthorizedJob } from '@/lib/auth'
import { withErrorLog } from '@/lib/log'
import { withJobLog } from '@/lib/job-log'

// 50 cities × (one Visual Crossing fetch + weight round-trips) take a while:
// the default 300 s that every route shares (one function — fewer
// cold starts) gives it room.

// Cap cities per run to stay within the Visual Crossing free tier (~1000 records/day)
const MAX_CITIES = 50

// Visual Crossing counts a day asked with its hours as 24 records, and its free plan has 1,000 a day, of
// which the live forecasts use about 170 (counted on 2026-11-21). The night's scoring stops before this many,
// counted from each answer's own queryCost: about 30 places, where the day's mean was one record a place and 50.
const MAX_RECORDS = 720

// The day's measured temperature hour by hour at a place, on the place's own clock (lib/daily-score.js dayHours)
async function fetchDay(lat, lon, date, key) {
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/${date}?unitGroup=metric&key=${key}&include=hours&elements=datetime,temp`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    return res.ok ? dayHours(await res.json()) : null
  } catch {
    return null
  }
}

// Daily auto-calibration: score yesterday's forecasts against the real weather and re-weight the APIs. A
// stored forecast is the temperature at the moment someone looked, so it is compared with the measured
// temperature of that same hour (lib/daily-score.js; until 2026-11-21 with the mean of the whole day).
export const GET = withErrorLog('calibrate', withJobLog('calibrate', async (request) => {
  if (!isAuthorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.VISUAL_CROSSING_KEY
  if (!key) return Response.json({ skipped: 'VISUAL_CROSSING_KEY not configured' })

  // Forecast rows are tagged with the CITY's local date, and Visual Crossing
  // interprets a plain date at the queried coordinates as local too — so
  // scoring "yesterday" compares each city against its own local day.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  // Never the same day twice — claimed before any work (lib/weights.js claimDay)
  if (!(await claimDay('__calibrate__', yesterday))) return Response.json({ skipped: 'already calibrated', date: yesterday })

  // Ordered oldest-first so "last row wins" below really is the latest per API.
  // Every page: one request stops at 1000 rows, and a busy day has thousands.
  const forecasts = await readAll((from, to) => supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, region, created_at')
    .eq('valid_for', yesterday)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to))
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
  let calibrated = 0, records = 0, left = 0

  for (const [i, { city, lat, lon, region }] of cities.entries()) {
    // the service's daily allowance: the places not reached tonight are counted, not scored
    if (records + 24 > MAX_RECORDS) { left = cities.length - i; break }
    const day = await fetchDay(lat, lon, yesterday, key)
    if (!day) { results.push({ city, skipped: 'no Visual Crossing data' }); continue }
    records += day.cost

    // latest stored forecast per API for this city
    const latestPerApi = {}
    forecasts.filter(f => f.city === city).forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)

    // each source's reading against the measurement of its own hour; the outlier rule is in there too
    const deltaMap = dailyDeltas(unique, day.hours, day.tzoffset)
    if (!Object.keys(deltaMap).length) { results.push({ city, skipped: 'no measurement at the hours of the readings' }); continue }

    const applied = await applyDeltas(region, deltaMap)
    if (!applied) continue

    // Mark this city's pending feedback as consumed now that weights are updated.
    await supabase.from('feedback').update({ processed: true }).eq('city', city).eq('processed', false)

    results.push({
      city,
      apis: applied.map(u => ({ id: u.id, delta: u.deltas[0] })),
    })
    calibrated++
  }


  return Response.json({ calibrated, date: yesterday, records, left, results })
}))

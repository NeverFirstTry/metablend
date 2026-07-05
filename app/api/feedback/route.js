import { supabase } from '@/lib/supabase'
import { deltaFromDiff, median } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { localDateForLon } from '@/lib/weather'
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'

// ── Rate limit ────────────────────────────────────────────────────────────────
// Split into check + mark so a report rejected by validation (deviation,
// nighttime sun, …) doesn't burn the user's one-per-hour slot.
const ipCache = new Map()
const ONE_HOUR = 60 * 60 * 1000

function isRateLimited(ip, city) {
  const last = ipCache.get(`${ip}:${city.toLowerCase()}`)
  return !!(last && Date.now() - last < ONE_HOUR)
}
function markRateLimit(ip, city) {
  // occasionally sweep expired entries so the map doesn't grow unbounded
  if (ipCache.size > 1000) {
    const now = Date.now()
    for (const [k, ts] of ipCache) if (now - ts >= ONE_HOUR) ipCache.delete(k)
  }
  ipCache.set(`${ip}:${city.toLowerCase()}`, Date.now())
}

// Only daytime-sun values (new i18n key + legacy German). "Clear"/"Klar" is a
// nighttime answer, so it's allowed around the clock.
const SUNNY_CONDITIONS = new Set(['sunny', 'Sonnig'])

export const POST = withErrorLog('feedback', async (request) => {
  const ip = clientIp(request)

  const body = await request.json()
  const { city, actualTemp, actualCond, reportDate, region = 'global', lat = null, lon = null } = body

  // ── Basic field validation ────────────────────────────────────────────────
  if (!city || actualTemp === undefined || !actualCond) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // ── Rate limit (check only; marked after the report is accepted) ──────────
  if (isRateLimited(ip, city)) {
    return Response.json(
      { error: 'You have already submitted feedback for this city in the last hour.' },
      { status: 429 }
    )
  }

  // ── Temperature sanity range ──────────────────────────────────────────────
  if (actualTemp < -50 || actualTemp > 60) {
    return Response.json(
      { error: `Temperature ${actualTemp}°C is outside the valid range (−50 to +60°C).` },
      { status: 422 }
    )
  }

  // ── Sunny condition at night (21:00–06:00 local) ──────────────────────────
  // The report carries the city's lon, so estimate its local hour from the
  // longitude (15° ≈ 1 h) instead of judging "night" by the server's UTC
  // clock — otherwise e.g. Sydney can't report sun for most of its day.
  const utcHour = new Date().getUTCHours() + new Date().getUTCMinutes() / 60
  const localHour = typeof lon === 'number' ? (((utcHour + lon / 15) % 24) + 24) % 24 : utcHour
  const isNight = localHour >= 21 || localHour < 6
  if (isNight && SUNNY_CONDITIONS.has(actualCond)) {
    return Response.json(
      { error: 'Sunny conditions cannot be reported between 9 PM and 6 AM.' },
      { status: 422 }
    )
  }

  // ── Load today's forecasts to validate consensus deviation ────────────────
  // Ordered oldest-first so "last row wins" below really is the latest per API.
  // "Today" is the CITY's local date (forecast rows are tagged the same way).
  const today = localDateForLon(lon)
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('api_id, temp, rain_pct, condition')
    .eq('city', city)
    .eq('valid_for', today)
    .order('created_at', { ascending: true })

  // how close the consensus got (1 = spot on, 0 = way off). feeds the heatmap.
  let accuracy = null
  if (forecasts?.length) {
    const latestPerApi = {}
    forecasts.forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)
    const consensusTemp = unique.reduce((s, f) => s + f.temp, 0) / unique.length

    if (Math.abs(actualTemp - consensusTemp) > 20) {
      return Response.json(
        { error: `Temperature deviates more than 20°C from the current forecast consensus (${consensusTemp.toFixed(1)}°C).` },
        { status: 422 }
      )
    }

    accuracy = Math.max(0, Math.min(1, 1 - Math.abs(actualTemp - consensusTemp) / 10))
  }

  // ── Save feedback ─────────────────────────────────────────────────────────
  // lat/lon/accuracy may not exist yet (migration4) — retry without them so a
  // missing column never blocks a submission.
  const baseRow = {
    city,
    actual_temp: actualTemp,
    actual_cond: actualCond,
    report_date: reportDate ?? today,
    processed: false,
  }
  const { error: insErr } = await supabase
    .from('feedback')
    .insert({ ...baseRow, lat, lon, accuracy })
  if (insErr) await supabase.from('feedback').insert(baseRow)

  markRateLimit(ip, city)

  if (!forecasts?.length) {
    return Response.json({ message: 'Feedback saved – no forecasts to compare yet.' })
  }

  const latestPerApi = {}
  forecasts.forEach(f => { latestPerApi[f.api_id] = f })
  const unique = Object.values(latestPerApi)

  // Median forecast temp across all APIs — used to flag outliers (see below).
  const medianTemp = median(unique.map(f => f.temp))

  // ── Score each API against the report ────────────────────────────────────
  const deltaMap = {}
  for (const forecast of unique) {
    const tempDiff = Math.abs(forecast.temp - actualTemp)
    // Outlier penalty: an API more than 5°C off the cross-API median gets a hard
    // −2 regardless of how the user feedback scored it.
    deltaMap[forecast.api_id] = Math.abs(forecast.temp - medianTemp) > 5
      ? -2
      : deltaFromDiff(tempDiff, 'instant')
  }

  const applied = await applyDeltas(region, deltaMap)
  if (!applied) return Response.json({ error: 'No API weights found' }, { status: 500 })

  // Mark this city's pending feedback as consumed now that weights are updated.
  await supabase.from('feedback').update({ processed: true }).eq('city', city).eq('processed', false)

  return Response.json({
    message: 'Thank you! Weights updated.',
    updates: applied.map(u => ({
      api: u.id,
      delta: u.deltas[0],
      weight: (u.weight * 100).toFixed(1) + '%',
    })),
  })
})

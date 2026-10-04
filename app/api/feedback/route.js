import { supabase } from '@/lib/supabase'
import { deltaFromDiff, median } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { updateCityBias } from '@/lib/blend'
import { getRegion } from '@/lib/weather'
import { isNightAt, localDateForLon } from '@/lib/localtime'
import { parseFeedback, feedbackOriginProblem, learnsFromReport } from '@/lib/feedback'
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

  // ── Only from MetaBlend's own pages (lib/feedback.js) ─────────────────────
  const foreign = feedbackOriginProblem(request.headers)
  if (foreign) return Response.json({ error: foreign.error }, { status: foreign.status })

  // ── Field validation (lib/feedback.js) ────────────────────────────────────
  // Types, ranges and the condition allowlist. Malformed JSON is a bad
  // request, not a server error.
  const parsed = parseFeedback(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const { city, actualTemp, actualCond, lat, lon } = parsed.value

  // ── Rate limit (check only; marked after the report is accepted) ──────────
  if (isRateLimited(ip, city)) {
    return Response.json(
      { error: 'You have already submitted feedback for this city in the last hour.' },
      { status: 429 }
    )
  }

  // ── Sunny condition at night (21:00–06:00 local) ──────────────────────────
  // Judged by the city's clock (estimated from its lon), not the server's UTC
  // clock — otherwise e.g. Sydney can't report sun for most of its day.
  if (isNightAt(lon) && SUNNY_CONDITIONS.has(actualCond)) {
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
    .select('api_id, temp, rain_pct, condition, lat, lon')
    .eq('city', city)
    .eq('valid_for', today)
    .order('created_at', { ascending: true })

  // Where we actually forecast this city anchors the report: its heatmap pin
  // and the weight region come from our own stored coordinates, never from
  // the client (which could drop pins anywhere and steer any region's
  // weights). No forecasts → no pin; there's no accuracy to show either.
  const anchor = forecasts?.find(f => typeof f.lat === 'number' && typeof f.lon === 'number') ?? null
  const region = anchor ? getRegion(anchor.lat, anchor.lon) : 'global'

  // how close the consensus got (1 = spot on, 0 = way off). feeds the heatmap.
  // The consensus proxy excludes our own synthetic source — MetaBlend Local
  // must never learn from itself.
  let accuracy = null
  let consensusTemp = null
  if (forecasts?.length) {
    const latestPerApi = {}
    forecasts.forEach(f => { latestPerApi[f.api_id] = f })
    const real = Object.values(latestPerApi).filter(f => f.api_id !== 'metablend')
    if (real.length) {
      consensusTemp = real.reduce((s, f) => s + f.temp, 0) / real.length

      if (Math.abs(actualTemp - consensusTemp) > 20) {
        return Response.json(
          { error: `Temperature deviates more than 20°C from the current forecast consensus (${consensusTemp.toFixed(1)}°C).` },
          { status: 422 }
        )
      }

      accuracy = Math.max(0, Math.min(1, 1 - Math.abs(actualTemp - consensusTemp) / 10))
    }
  }

  // ── Save feedback ─────────────────────────────────────────────────────────
  // lat/lon/accuracy may not exist yet (migration4) — retry without them so a
  // missing column never blocks a submission.
  const baseRow = {
    city,
    actual_temp: actualTemp,
    actual_cond: actualCond,
    report_date: today,
    processed: false,
  }
  const { error: insErr } = await supabase
    .from('feedback')
    .insert({ ...baseRow, lat: anchor?.lat ?? null, lon: anchor?.lon ?? null, accuracy })
  if (insErr) await supabase.from('feedback').insert(baseRow)

  markRateLimit(ip, city)

  // ── One lesson per city per window ────────────────────────────────────────
  // The report is saved (map, accuracy) either way; only the first one in a
  // window moves the weights and the city's bias (lib/feedback.js).
  const { data: lastLearned } = await supabase
    .from('feedback')
    .select('created_at')
    .eq('city', city)
    .eq('processed', true)
    .order('created_at', { ascending: false })
    .limit(1)
  if (!learnsFromReport(lastLearned?.[0]?.created_at ?? null)) {
    return Response.json({ message: 'Thank you! Feedback saved.' })
  }

  // Teach MetaBlend Local: this report's error vs the consensus moves the
  // city's learned bias (lib/blend.js).
  if (consensusTemp != null) {
    await updateCityBias(city, anchor?.lat ?? lat, anchor?.lon ?? lon, region, actualTemp - consensusTemp)
  }

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
    // Raw 0..1 weights so the page can show the effect straight away — a
    // reload would just hit the forecast route's 15-min cache (old weights).
    weights: Object.fromEntries(applied.map(u => [u.id, u.weight])),
  })
})

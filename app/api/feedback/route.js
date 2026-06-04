import { supabase } from '@/lib/supabase'

// ── Rate limit ────────────────────────────────────────────────────────────────
const ipCache = new Map()
const ONE_HOUR = 60 * 60 * 1000

function checkRateLimit(ip, city) {
  const key = `${ip}:${city.toLowerCase()}`
  const last = ipCache.get(key)
  if (last && Date.now() - last < ONE_HOUR) return true
  ipCache.set(key, Date.now())
  return false
}

// ── Median helper ─────────────────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Only daytime-sun values (new i18n key + legacy German). "Clear"/"Klar" is a
// nighttime answer, so it's allowed around the clock.
const SUNNY_CONDITIONS = new Set(['sunny', 'Sonnig'])
// Beta: re-weight on every single report (1) instead of waiting for a batch, so
// each data point a user submits immediately nudges the weights.
const MIN_REPORTS_TO_UPDATE = 1

export async function POST(request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  const body = await request.json()
  const { city, actualTemp, actualCond, reportDate, region = 'global', lat = null, lon = null } = body

  // ── Basic field validation ────────────────────────────────────────────────
  if (!city || actualTemp === undefined || !actualCond) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // ── Temperature sanity range ──────────────────────────────────────────────
  if (actualTemp < -50 || actualTemp > 60) {
    return Response.json(
      { error: `Temperature ${actualTemp}°C is outside the valid range (−50 to +60°C).` },
      { status: 422 }
    )
  }

  // ── Sunny condition at night (21:00–06:00 UTC) ────────────────────────────
  const utcHour = new Date().getUTCHours()
  const isNight = utcHour >= 21 || utcHour < 6
  if (isNight && SUNNY_CONDITIONS.has(actualCond)) {
    return Response.json(
      { error: 'Sunny conditions cannot be reported between 9 PM and 6 AM.' },
      { status: 422 }
    )
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (checkRateLimit(ip, city)) {
    return Response.json(
      { error: 'You have already submitted feedback for this city in the last hour.' },
      { status: 429 }
    )
  }

  // ── Load today's forecasts to validate consensus deviation ────────────────
  const today = new Date().toISOString().split('T')[0]
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('api_id, temp, rain_pct, condition')
    .eq('city', city)
    .eq('valid_for', today)

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

  // ── Minimum report threshold ──────────────────────────────────────────────
  const { count: reportCount } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('city', city)
    .neq('actual_cond', '__meteostat__')  // exclude validation sentinels

  if ((reportCount ?? 0) < MIN_REPORTS_TO_UPDATE) {
    const remaining = MIN_REPORTS_TO_UPDATE - (reportCount ?? 0)
    return Response.json({
      message: `Feedback saved. Weights will update once ${remaining} more report${remaining === 1 ? '' : 's'} are collected for ${city}.`,
    })
  }

  if (!forecasts?.length) {
    return Response.json({ message: 'Feedback saved – no forecasts to compare yet.' })
  }

  const latestPerApi = {}
  forecasts.forEach(f => { latestPerApi[f.api_id] = f })
  const unique = Object.values(latestPerApi)

  // ── Load weights (with delta_history if the column exists) ────────────────
  const tryWithHistory = async (regionFilter) => {
    const q = supabase.from('api_weights').select('id, score, reports, weight, delta_history')
    return regionFilter ? q.eq('region', regionFilter) : q
  }

  let { data: allWeights, error: wErr } = await tryWithHistory(region)
  const hasHistory = !wErr

  if (!allWeights?.length) {
    // Try global or without region filter
    const { data: fallback } = hasHistory
      ? await tryWithHistory(null)
      : await supabase.from('api_weights').select('id, score, reports, weight').eq('region', region)
    allWeights = fallback

    if (!allWeights?.length) {
      const { data: global } = await supabase.from('api_weights').select('id, score, reports, weight')
      allWeights = global
    }
  }

  if (!allWeights) return Response.json({ error: 'No API weights found' }, { status: 500 })

  const weightMap = {}
  allWeights.forEach(w => { weightMap[w.id] = w })

  // ── Compute score deltas using median of history ───────────────────────────
  const updates = []
  for (const forecast of unique) {
    const cur = weightMap[forecast.api_id]
    if (!cur) continue

    const tempDiff = Math.abs(forecast.temp - actualTemp)
    const delta = tempDiff <= 1 ? +2 : tempDiff <= 2 ? +1 : tempDiff <= 4 ? 0 : tempDiff <= 6 ? -1 : -2

    const newScore   = cur.score + delta
    const newReports = cur.reports + 1

    // Median-based rawFactor when history is available; fall back to mean
    let rawFactor
    if (hasHistory && Array.isArray(cur.delta_history)) {
      const history = [...cur.delta_history, delta].slice(-50)
      rawFactor = Math.max(0.05, 1 + median(history) * 0.3)
      updates.push({ id: forecast.api_id, score: newScore, reports: newReports, rawFactor, delta, history })
    } else {
      rawFactor = Math.max(0.05, 1 + (newScore / newReports) * 0.3)
      updates.push({ id: forecast.api_id, score: newScore, reports: newReports, rawFactor, delta, history: null })
    }
  }

  // Include untouched APIs so normalization stays correct
  const updatedIds = new Set(updates.map(u => u.id))
  allWeights.forEach(w => {
    if (!updatedIds.has(w.id)) {
      let rawFactor
      if (hasHistory && Array.isArray(w.delta_history) && w.delta_history.length) {
        rawFactor = Math.max(0.05, 1 + median(w.delta_history) * 0.3)
      } else {
        const avg = w.reports > 0 ? w.score / w.reports : 0
        rawFactor = Math.max(0.05, 1 + avg * 0.3)
      }
      updates.push({ id: w.id, score: w.score, reports: w.reports, rawFactor, delta: null, history: null })
    }
  })

  const totalFactor = updates.reduce((s, u) => s + u.rawFactor, 0)

  // ── Persist updated weights ───────────────────────────────────────────────
  for (const u of updates) {
    const newWeight = u.rawFactor / totalFactor
    const payload = {
      score: u.score,
      reports: u.reports,
      weight: newWeight,
      updated_at: new Date().toISOString(),
      ...(hasHistory && u.history !== null ? { delta_history: u.history } : {}),
    }

    const { error } = await supabase.from('api_weights').update(payload).eq('id', u.id).eq('region', region)
    if (error) await supabase.from('api_weights').update(payload).eq('id', u.id)
  }

  return Response.json({
    message: 'Thank you! Weights updated.',
    updates: updates
      .filter(u => u.delta !== null)
      .map(u => ({ api: u.id, delta: u.delta, weight: (u.rawFactor / totalFactor * 100).toFixed(1) + '%' })),
  })
}

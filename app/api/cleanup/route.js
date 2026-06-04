import { supabase } from '@/lib/supabase'
import { deltaFromDiff, rawFactor } from '@/lib/scoring'

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
  if (!process.env.RAPIDAPI_KEY) return { skipped: 'RAPIDAPI_KEY not configured' }

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  // Guard: a sentinel row in feedback marks "already validated this date"
  const { data: sentinel } = await supabase
    .from('feedback')
    .select('id')
    .eq('report_date', yesterday)
    .eq('actual_cond', '__meteostat__')
    .limit(1)

  if (sentinel?.length) return { skipped: 'already validated', date: yesterday }

  // Fetch all of yesterday's stored forecasts
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, region')
    .eq('valid_for', yesterday)

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
    if (!actual?.tavg) {
      results.push({ city, skipped: 'no Meteostat data' })
      continue
    }

    const actualTemp = actual.tavg  // daily average – best single comparison point
    const cityForecasts = forecasts.filter(f => f.city === city)

    // Load region-specific weights, falling back to global
    const { data: regionRows, error: rwErr } = await supabase
      .from('api_weights')
      .select('id, score, reports, weight')
      .eq('region', region)

    let allWeights = (!rwErr && regionRows?.length) ? regionRows : null
    if (!allWeights) {
      const { data: gw } = await supabase.from('api_weights').select('id, score, reports, weight')
      allWeights = gw ?? []
    }

    const wMap = {}
    allWeights.forEach(w => { wMap[w.id] = w })

    // Score each API's forecast against the actual daily average.
    // Thresholds are wider than user-feedback (2/4/6/8°) because we're
    // comparing an instantaneous forecast against a 24-h mean.
    const updates = []
    for (const fc of cityForecasts) {
      const cur = wMap[fc.api_id]
      if (!cur) continue
      const diff  = Math.abs(fc.temp - actualTemp)
      const delta = deltaFromDiff(diff, 'daily')

      const newScore   = cur.score + delta
      const newReports = cur.reports + 1
      updates.push({ id: fc.api_id, score: newScore, reports: newReports, rawFactor: rawFactor(newScore, newReports, null), delta })
    }

    // Include APIs that had no forecast for this city so normalization stays correct
    const updatedIds = new Set(updates.map(u => u.id))
    allWeights.forEach(w => {
      if (!updatedIds.has(w.id)) {
        updates.push({ id: w.id, score: w.score, reports: w.reports, rawFactor: rawFactor(w.score, w.reports, null), delta: null })
      }
    })

    if (!updates.length) continue

    const totalFactor = updates.reduce((s, u) => s + u.rawFactor, 0)

    for (const u of updates) {
      const payload = {
        score: u.score,
        reports: u.reports,
        weight: u.rawFactor / totalFactor,
        updated_at: new Date().toISOString(),
      }
      // Try region-specific row; fall back to matching only on id
      const { error } = await supabase.from('api_weights').update(payload).eq('id', u.id).eq('region', region)
      if (error) await supabase.from('api_weights').update(payload).eq('id', u.id)
    }

    results.push({
      city,
      actualTemp,
      apis: updates.filter(u => u.delta !== null).map(u => ({ id: u.id, delta: u.delta })),
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
export async function GET() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [{ error: fe }, { error: fb }] = await Promise.all([
    supabase.from('forecasts').delete().lt('created_at', cutoff),
    supabase.from('feedback').delete().lt('created_at', cutoff),
  ])

  const validation = await runMeteostatValidation()

  if (fe || fb) {
    return Response.json({ error: fe?.message ?? fb?.message, validation }, { status: 500 })
  }

  return Response.json({ ok: true, cutoff, validation })
}

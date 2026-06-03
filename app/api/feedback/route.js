import { supabase } from '@/lib/supabase'

const ipCache = new Map()
const ONE_HOUR = 60 * 60 * 1000

function checkRateLimit(ip, city) {
  const key = `${ip}:${city.toLowerCase()}`
  const last = ipCache.get(key)
  if (last && Date.now() - last < ONE_HOUR) return true
  ipCache.set(key, Date.now())
  return false
}

export async function POST(request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  const body = await request.json()
  const { city, actualTemp, actualCond, reportDate, region = 'global' } = body

  if (!city || actualTemp === undefined || !actualCond) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (checkRateLimit(ip, city)) {
    return Response.json(
      { error: 'You have already submitted feedback for this city in the last hour.' },
      { status: 429 }
    )
  }

  // 1. Feedback speichern
  await supabase.from('feedback').insert({
    city,
    actual_temp: actualTemp,
    actual_cond: actualCond,
    report_date: reportDate ?? new Date().toISOString().split('T')[0],
    processed: false,
  })

  // 2. Prognosen von heute laden
  const today = new Date().toISOString().split('T')[0]
  const { data: forecasts } = await supabase
    .from('forecasts')
    .select('api_id, temp, rain_pct, condition')
    .eq('city', city)
    .eq('valid_for', today)

  if (!forecasts || forecasts.length === 0) {
    return Response.json({ message: 'Feedback saved – no forecasts to compare yet.' })
  }

  const latestPerApi = {}
  forecasts.forEach(f => { latestPerApi[f.api_id] = f })
  const unique = Object.values(latestPerApi)

  // 3. Region-specific weights, falling back to global
  const { data: regionWeights, error: rwErr } = await supabase
    .from('api_weights')
    .select('id, score, reports, weight')
    .eq('region', region)

  let allWeights = (!rwErr && regionWeights?.length) ? regionWeights : null

  if (!allWeights) {
    const { data: globalWeights } = await supabase
      .from('api_weights')
      .select('id, score, reports, weight')
    allWeights = globalWeights
  }

  if (!allWeights) return Response.json({ error: 'No API weights found' }, { status: 500 })

  const weightMap = {}
  allWeights.forEach(w => { weightMap[w.id] = w })

  // 4. Score berechnen
  const updates = []
  for (const forecast of unique) {
    const current = weightMap[forecast.api_id]
    if (!current) continue

    const tempDiff = Math.abs(forecast.temp - actualTemp)
    let delta = 0
    if (tempDiff <= 1)      delta = +2
    else if (tempDiff <= 2) delta = +1
    else if (tempDiff <= 4) delta =  0
    else if (tempDiff <= 6) delta = -1
    else                    delta = -2

    const newScore   = current.score + delta
    const newReports = current.reports + 1
    const rawFactor  = Math.max(0.05, 1 + (newScore / newReports) * 0.3)
    updates.push({ id: forecast.api_id, score: newScore, reports: newReports, rawFactor, delta })
  }

  // 5. Gewichte normalisieren
  const updatedIds = new Set(updates.map(u => u.id))
  allWeights.forEach(w => {
    if (!updatedIds.has(w.id)) {
      const avg = w.reports > 0 ? w.score / w.reports : 0
      updates.push({ id: w.id, score: w.score, reports: w.reports, rawFactor: Math.max(0.05, 1 + avg * 0.3), delta: null })
    }
  })

  const totalFactor = updates.reduce((s, u) => s + u.rawFactor, 0)

  // 6. Gewichte updaten (region-specific row if available, else global)
  for (const u of updates) {
    const newWeight = u.rawFactor / totalFactor
    const q = supabase
      .from('api_weights')
      .update({ score: u.score, reports: u.reports, weight: newWeight, updated_at: new Date().toISOString() })
      .eq('id', u.id)

    // Try region-specific row first; fall back to plain id filter
    const { error } = await q.eq('region', region)
    if (error) await supabase.from('api_weights').update({ score: u.score, reports: u.reports, weight: newWeight, updated_at: new Date().toISOString() }).eq('id', u.id)
  }

  return Response.json({
    message: 'Thank you! Weights updated.',
    updates: updates
      .filter(u => u.delta !== null)
      .map(u => ({ api: u.id, delta: u.delta, weight: (u.rawFactor / totalFactor * 100).toFixed(1) + '%' })),
  })
}

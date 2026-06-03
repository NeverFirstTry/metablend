import { supabase } from '@/lib/supabase'

export async function POST(request) {
  const body = await request.json()
  const { city, actualTemp, actualCond, reportDate } = body

  if (!city || actualTemp === undefined || !actualCond) {
    return Response.json({ error: 'Fehlende Felder' }, { status: 400 })
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

  if (!forecasts || forecasts.length === 0) {
    return Response.json({ message: 'Feedback gespeichert, keine Prognosen zum Vergleichen' })
  }

  // Duplikate pro API – nur eine Prognose pro API
  const latestPerApi = {}
  forecasts.forEach(f => { latestPerApi[f.api_id] = f })
  const unique = Object.values(latestPerApi)

  // 3. Alle aktuellen Gewichte laden
  const { data: allWeights } = await supabase
    .from('api_weights')
    .select('id, score, reports, weight')

  if (!allWeights) return Response.json({ error: 'Keine API-Gewichte gefunden' }, { status: 500 })

  const weightMap = {}
  allWeights.forEach(w => weightMap[w.id] = w)

  // 4. Score für jede API berechnen
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
    const avgScore   = newScore / newReports
    const rawFactor  = Math.max(0.05, 1 + avgScore * 0.3)

    updates.push({ id: forecast.api_id, score: newScore, reports: newReports, rawFactor, delta })
  }

  // 5. Gewichte normalisieren – APIs ohne Feedback behalten ihren rawFactor
  const updatedIds = updates.map(u => u.id)
  allWeights.forEach(w => {
    if (!updatedIds.includes(w.id)) {
      const avg = w.reports > 0 ? w.score / w.reports : 0
      updates.push({
        id: w.id, score: w.score, reports: w.reports,
        rawFactor: Math.max(0.05, 1 + avg * 0.3), delta: null,
      })
    }
  })

  const totalFactor = updates.reduce((s, u) => s + u.rawFactor, 0)

  // 6. Alle APIs updaten
  for (const u of updates) {
    const newWeight = u.rawFactor / totalFactor
    await supabase
      .from('api_weights')
      .update({ score: u.score, reports: u.reports, weight: newWeight, updated_at: new Date().toISOString() })
      .eq('id', u.id)
  }

  return Response.json({
    message: 'Danke! Gewichtung aktualisiert.',
    updates: updates
      .filter(u => u.delta !== null)
      .map(u => ({ api: u.id, delta: u.delta, weight: (u.rawFactor / totalFactor * 100).toFixed(1) + '%' }))
  })
}
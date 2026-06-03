import { supabase } from '@/lib/supabase'

// Fires a POST to WEBHOOK_URL for any city whose consensus confidence has
// recently dropped below 40%. Triggered in the background by the forecast route
// (and safe to hit from a cron). One alert per city per run.
export async function GET() {
  const url = process.env.WEBHOOK_URL
  if (!url) return Response.json({ skipped: 'WEBHOOK_URL not configured' })

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('consensus_history')
    .select('city, country, temp, rain_pct, wind_kmh, confidence_pct, condition, created_at')
    .lt('confidence_pct', 40)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const seen = new Set()
  const sent = []
  for (const r of data ?? []) {
    if (seen.has(r.city)) continue
    seen.add(r.city)
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'low_consensus_confidence',
          city: r.city,
          country: r.country,
          consensus: {
            temp: r.temp,
            rainPct: r.rain_pct,
            windKmh: r.wind_kmh,
            confidencePct: r.confidence_pct,
            condition: r.condition,
          },
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      })
      sent.push(r.city)
    } catch { /* webhook target down — skip */ }
  }

  return Response.json({ sent })
}

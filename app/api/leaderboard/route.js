import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/log'
import { HORIZONS } from '@/lib/outlook/weights'
import { groupByRegion } from '@/lib/rankings'

export async function GET() {
  const { data, error } = await supabase
    .from('api_weights')
    .select('id, name, weight, score, reports, updated_at, region, delta_history')
    .order('weight', { ascending: false })
  if (error) {
    await logError('leaderboard', error)
    return Response.json({ error: 'Leaderboard unavailable right now' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  // response time + uptime per API (optional table)
  const stats = {}
  const { data: statRows } = await supabase
    .from('api_stats')
    .select('api_id, avg_response_ms, success_count, fail_count')
  ;(statRows ?? []).forEach(s => {
    const total = (s.success_count ?? 0) + (s.fail_count ?? 0)
    stats[s.api_id] = {
      avgMs: s.avg_response_ms,
      uptime: total ? Math.round((s.success_count / total) * 1000) / 10 : null,
    }
  })

  const regions = groupByRegion(data ?? [], stats)

  // Outlook rankings per range. api_stats timings belong to the live
  // endpoints, so they're deliberately not attached here.
  const { data: ow } = await supabase
    .from('outlook_weights')
    .select('id, name, weight, score, reports, updated_at, region, horizon, delta_history')
    .in('horizon', HORIZONS)
  const horizons = Object.fromEntries(
    HORIZONS.map(h => [h, groupByRegion((ow ?? []).filter(r => r.horizon === h), {})])
  )

  // weights change with the hourly calibration: one copy per 5 minutes
  return Response.json({ regions, horizons }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
}

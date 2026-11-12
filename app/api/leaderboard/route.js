import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { noStore } from '@/lib/no-store'
import { HORIZONS } from '@/lib/outlook/weights'
import { groupByRegion } from '@/lib/rankings'

// The page asks this once per visit and the CDN answers almost all of it; only an address that gets past
// the CDN (a new query string each time) reaches the database. Thirty a minute is far above a visitor.
// Over that the last answer built here comes back, not an error; 429 only when there is none yet.
const limiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })
let last = null

export async function GET(request) {
  if (limiter.limited(clientIp(request))) return last ? Response.json(last, { headers: { 'Cache-Control': 'no-store' } }) : noStore({ error: 'Too many requests — please slow down.' }, 429)
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
  last = { regions, horizons }
  return Response.json(last, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
}

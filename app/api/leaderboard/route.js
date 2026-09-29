import { supabase } from '@/lib/supabase'
import { HORIZONS } from '@/lib/outlook/weights'

const REGION_ORDER = ['global', 'europe', 'north_america', 'south_america', 'asia', 'africa', 'oceania']

// Rows → [{ region, apis, leader }], best-weighted first, stats attached.
function groupByRegion(rows, stats) {
  const byRegion = {}
  for (const row of rows) {
    const region = row.region ?? 'global'
    ;(byRegion[region] ??= []).push({ ...row, ...stats[row.id] })
  }
  for (const region of Object.keys(byRegion)) {
    byRegion[region].sort((a, b) => b.weight - a.weight)
  }
  return REGION_ORDER.filter(r => byRegion[r]?.length).map(region => ({
    region,
    apis: byRegion[region],
    leader: byRegion[region][0] ?? null,
  }))
}

export async function GET() {
  let { data, error } = await supabase
    .from('api_weights')
    .select('id, name, weight, score, reports, updated_at, region, delta_history')
    .order('weight', { ascending: false })

  // Pre-migration DBs don't have the `region` column yet — fall back to a
  // region-less query and treat every row as global, rather than 500-ing.
  if (error) {
    ;({ data, error } = await supabase
      .from('api_weights')
      .select('id, name, weight, score, reports, updated_at')
      .order('weight', { ascending: false }))
    if (error) return Response.json({ error: error.message }, { status: 500 })
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

  // flat global list, kept around for older clients
  const apis = regions.find(r => r.region === 'global')?.apis ?? data ?? []

  // Outlook rankings per range. api_stats timings belong to the live
  // endpoints, so they're deliberately not attached here.
  const { data: ow } = await supabase
    .from('outlook_weights')
    .select('id, name, weight, score, reports, updated_at, region, horizon, delta_history')
    .in('horizon', HORIZONS)
  const horizons = Object.fromEntries(
    HORIZONS.map(h => [h, groupByRegion((ow ?? []).filter(r => r.horizon === h), {})])
  )

  return Response.json({ regions, apis, horizons })
}

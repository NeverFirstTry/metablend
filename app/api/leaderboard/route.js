import { supabase } from '@/lib/supabase'

const REGION_ORDER = ['global', 'europe', 'north_america', 'south_america', 'asia', 'africa', 'oceania']

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

  // bucket by region, best-weighted first, attach stats
  const byRegion = {}
  for (const row of data ?? []) {
    const region = row.region ?? 'global'
    ;(byRegion[region] ??= []).push({ ...row, ...stats[row.id] })
  }
  for (const region of Object.keys(byRegion)) {
    byRegion[region].sort((a, b) => b.weight - a.weight)
  }

  const regions = REGION_ORDER.filter(r => byRegion[r]?.length).map(region => ({
    region,
    apis: byRegion[region],
    leader: byRegion[region][0] ?? null,
  }))

  // flat global list, kept around for older clients
  const apis = byRegion.global ?? data ?? []

  return Response.json({ regions, apis })
}

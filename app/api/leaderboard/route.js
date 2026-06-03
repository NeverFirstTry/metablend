import { supabase } from '@/lib/supabase'

const REGION_ORDER = ['global', 'europe', 'north_america', 'south_america', 'asia', 'africa', 'oceania']

export async function GET() {
  const { data, error } = await supabase
    .from('api_weights')
    .select('id, name, weight, score, reports, updated_at, region')
    .order('weight', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Group rows by region so the page can show a per-region leaderboard.
  const byRegion = {}
  for (const row of data ?? []) {
    const region = row.region ?? 'global'
    ;(byRegion[region] ??= []).push(row)
  }
  for (const region of Object.keys(byRegion)) {
    byRegion[region].sort((a, b) => b.weight - a.weight)
  }

  const regions = REGION_ORDER.filter(r => byRegion[r]?.length).map(region => ({
    region,
    apis: byRegion[region],
    leader: byRegion[region][0] ?? null,
  }))

  // Backward-compatible flat list (global region) for older clients.
  const apis = byRegion.global ?? data ?? []

  return Response.json({ regions, apis })
}

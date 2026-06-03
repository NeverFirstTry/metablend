import { supabase } from '@/lib/supabase'

const REGION_ORDER = ['global', 'europe', 'north_america', 'south_america', 'asia', 'africa', 'oceania']

export async function GET() {
  const { data, error } = await supabase
    .from('api_weights')
    .select('id, name, weight, score, reports, updated_at, region')
    .order('weight', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // bucket by region, best-weighted first
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

  // flat global list, kept around for older clients
  const apis = byRegion.global ?? data ?? []

  return Response.json({ regions, apis })
}

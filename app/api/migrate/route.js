import { supabase } from '@/lib/supabase'

const REGIONS = ['global', 'europe', 'north_america', 'south_america', 'asia', 'africa', 'oceania']
const APIS = [
  { id: 'open-meteo', name: 'Open-Meteo' },
  { id: 'owm',        name: 'OpenWeatherMap' },
  { id: 'weatherapi', name: 'WeatherAPI' },
  { id: 'tomorrow',   name: 'Tomorrow.io' },
  { id: 'met-norway', name: 'MET Norway' },
]

// One-time data setup endpoint.
// DDL (ALTER TABLE, composite PK) must be run separately via supabase/migration.sql
// in the Supabase SQL editor. This endpoint seeds the weight rows.
export async function GET() {
  const rows = []
  for (const api of APIS) {
    for (const region of REGIONS) {
      rows.push({ id: api.id, region, weight: 0.25, score: 0, reports: 0, name: api.name })
    }
  }

  const { error } = await supabase
    .from('api_weights')
    .upsert(rows, { onConflict: 'id,region', ignoreDuplicates: true })

  if (error) {
    return Response.json({
      error: error.message,
      hint: 'Make sure supabase/migration.sql has been run first to add the region column and composite primary key.',
    }, { status: 500 })
  }

  return Response.json({ ok: true, seeded: rows.length })
}

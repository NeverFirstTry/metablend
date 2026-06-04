import { supabase } from '@/lib/supabase'

const REGIONS = ['global', 'europe', 'north_america', 'south_america', 'asia', 'africa', 'oceania']
const APIS = [
  { id: 'open-meteo',      name: 'Open-Meteo' },
  { id: 'owm',             name: 'OpenWeatherMap' },
  { id: 'weatherapi',      name: 'WeatherAPI' },
  { id: 'tomorrow',        name: 'Tomorrow.io' },
  { id: 'met-norway',      name: 'MET Norway' },
  { id: 'visual-crossing',      name: 'Visual Crossing' },
  { id: 'world-weather-online', name: 'World Weather Online' },
  { id: 'weatherstack',         name: 'Weatherstack' },
  { id: 'nasa-power',           name: 'NASA POWER' },
  // GeoSphere only covers Austria → seed it for europe + the global pool only.
  { id: 'geosphere',            name: 'GeoSphere Austria', regions: ['global', 'europe'] },
]

// One-time data setup endpoint.
// DDL (ALTER TABLE, composite PK) must be run separately via supabase/migration.sql
// in the Supabase SQL editor. This endpoint seeds the weight rows.
export async function GET() {
  const rows = []
  for (const api of APIS) {
    for (const region of (api.regions ?? REGIONS)) {
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

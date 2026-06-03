import { supabase } from '@/lib/supabase'

// Feedback points with coords, each tagged with how accurate the consensus was.
export async function GET() {
  const { data, error } = await supabase
    .from('feedback')
    .select('city, lat, lon, accuracy, actual_temp, created_at')
    .not('lat', 'is', null)
    .not('lon', 'is', null)
    .neq('actual_cond', '__meteostat__')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    // probably the lat/lon columns aren't there yet — just hand back nothing
    return Response.json({ points: [], note: error.message })
  }

  const points = (data ?? [])
    .filter(r => typeof r.lat === 'number' && typeof r.lon === 'number')
    .map(r => ({
      city: r.city,
      lat: r.lat,
      lon: r.lon,
      accuracy: r.accuracy,
      temp: r.actual_temp,
    }))

  return Response.json({ points })
}

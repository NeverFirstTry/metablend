import { supabase } from '@/lib/supabase'

// Returns geolocated feedback points for the global accuracy heatmap.
// Each point carries the consensus accuracy (0 = APIs were wrong, 1 = accurate).
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
    // Column likely missing (migration4 not run) → return empty set gracefully
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

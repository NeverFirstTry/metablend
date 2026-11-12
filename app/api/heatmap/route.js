import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { noStore } from '@/lib/no-store'

// Feedback points with coords, each tagged with how accurate the consensus was.
// The page asks this once per visit and the CDN answers almost all of it; only an address that gets past
// the CDN (a new query string each time) reaches the database. Thirty a minute is far above a visitor.
// Over that the last answer built here comes back, not an error; 429 only when there is none yet.
const limiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })
let last = null

export async function GET(request) {
  if (limiter.limited(clientIp(request))) return last ? Response.json(last, { headers: { 'Cache-Control': 'no-store' } }) : noStore({ error: 'Too many requests — please slow down.' }, 429)
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
    await logError('heatmap', error)
    return Response.json({ points: [] }, { headers: { 'Cache-Control': 'no-store' } })
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

  // the map changes with new reports, not by the second: one copy per 10 minutes
  last = { points }
  return Response.json(last, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' } })
}

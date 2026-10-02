import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { supabase } from '@/lib/supabase'
import { parsePeakQuery } from '@/lib/hike/params'
import { getJson, lastUpstreamFailure } from '@/lib/outlook/http'
import { fetchElevations } from '@/lib/hike/sources'
import { findRoutes } from '@/lib/route/find'

// The marked routes up a peak (OpenStreetMap). One OSM lookup per peak a
// week (route_cache), plus a day on the CDN; an OSM outage serves the stale
// copy rather than nothing.
// GET /api/routes?lat=47.0745&lon=12.6941&elev=3798&name=Großglockner
export const maxDuration = 60

const WEEK = 7 * 86400e3
const limiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const ok = routes => Response.json({ routes }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })

export const GET = withErrorLog('routes', async (request) => {
  const peak = parsePeakQuery(new URL(request.url).searchParams)
  if (!peak) return noStore({ error: 'lat, lon and elev are required' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const key = `${peak.lat.toFixed(3)},${peak.lon.toFixed(3)}`
  const { data: cached } = await supabase.from('route_cache').select('routes, fetched_at').eq('peak_key', key).maybeSingle()
  if (cached && Date.now() - Date.parse(cached.fetched_at) < WEEK) return ok(cached.routes)
  const fresh = await findRoutes(peak, { getJson, getElevations: fetchElevations })
  if (fresh) {
    await supabase.from('route_cache').upsert({ peak_key: key, routes: fresh, fetched_at: new Date().toISOString() })
    return ok(fresh)
  }
  if (cached) return ok(cached.routes)
  return noStore({ error: 'Routes unavailable right now', upstream: lastUpstreamFailure() }, 502)
})

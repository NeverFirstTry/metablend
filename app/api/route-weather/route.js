import { withErrorLog, logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { getRegion } from '@/lib/weather'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { getJson, lastUpstreamFailure } from '@/lib/outlook/http'
import { fetchElevations } from '@/lib/hike/sources'
import { parseRouteBody } from '@/lib/route/validate'
import { routeWeather } from '@/lib/route/weather'

// Weather along a route, walking times and the suggested start.
// POST /api/route-weather { points: [[lat, lon, ele|null]…], date, pace?, start?, roundTrip? }
export const maxDuration = 60

const limiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const POST = withErrorLog('route-weather', async (request) => {
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const q = parseRouteBody(await request.json().catch(() => null), new Date().toISOString().slice(0, 10))
  if (!q.ok) return noStore({ error: q.error }, 400)
  const p0 = q.value.points[0]
  const weights = await loadOutlookWeights(getRegion(p0.lat, p0.lon))
  const r = await routeWeather(q.value, { getJson, getElevations: fetchElevations, weights })
  if (!r) {
    await logError('route.upstream', new Error('route weather unavailable'), { upstream: lastUpstreamFailure() })
    return noStore({ error: 'Weather along the route is unavailable right now', upstream: lastUpstreamFailure() }, 502)
  }
  return noStore(r, 200)
})

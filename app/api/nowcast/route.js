import { withErrorLog, logError } from '@/lib/log'
import { clientIp, isInternal } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { getJson, lastUpstreamFailure } from '@/lib/outlook/http'
import { parseNowcastQuery, nowcastUrl, blendSteps } from '@/lib/nowcast'

// Rain in the next 2 hours for a place: the blended 15-minute steps
// (lib/nowcast.js). Consumers summarize against their own clock, so the
// CDN may keep a response for 5 minutes.
const TTL = 300
const CACHE = new Map()
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 }) // cache misses per minute, per IP
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const cdn = ttl => ({ 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${TTL}` })

export const GET = withErrorLog('nowcast', async (request) => {
  const q = parseNowcastQuery(new URL(request.url).searchParams)
  if (!q) return noStore({ error: 'lat and lon are required' }, 400)
  const key = `${q.lat},${q.lon}`
  const hit = CACHE.get(key)
  const age = hit ? Date.now() - hit.ts : Infinity
  if (age < TTL * 1000) return Response.json(hit.nc, { headers: cdn(Math.max(1, Math.round(TTL - age / 1000))) })
  if (!isInternal(request) && limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const nc = blendSteps(await getJson(nowcastUrl(q), { ms: 8000, retries: 1 }))
  if (!nc) {
    await logError('nowcast.upstream', new Error('nowcast unavailable'), { upstream: lastUpstreamFailure() })
    return noStore({ error: 'Rain for the next 2 hours is unavailable right now', upstream: lastUpstreamFailure() }, 502)
  }
  CACHE.set(key, { ts: Date.now(), nc })
  return Response.json(nc, { headers: cdn(TTL) })
})

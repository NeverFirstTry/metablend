import { withErrorLog } from '@/lib/log'
import { clientIp, isInternal } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { getRegion } from '@/lib/weather'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { parsePeakQuery } from '@/lib/hike/params'
import { fetchSummitRaw } from '@/lib/hike/sources'
import { buildHike } from '@/lib/hike/build'

// Summit forecast for one peak: the outlook's models downscaled to its
// height. Language-neutral and CDN-cached per peak for 30 minutes.
export const maxDuration = 30

const TTL = 1800
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('hike', async (request) => {
  const peak = parsePeakQuery(new URL(request.url).searchParams)
  if (!peak) return noStore({ error: 'lat, lon and elev are required' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (!isInternal(request) && limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const region = getRegion(peak.lat, peak.lon)
  const [multi, weights] = await Promise.all([
    fetchSummitRaw(peak.lat, peak.lon, peak.elev),
    loadOutlookWeights(region),
  ])
  const payload = buildHike({ peak, region, multi, weights })
  if (!payload.hourly.length) return noStore({ error: 'Summit forecast unavailable right now — please try again shortly.' }, 502)

  return Response.json(payload, {
    headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` },
  })
})

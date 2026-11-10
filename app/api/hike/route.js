import { withErrorLog, logError } from '@/lib/log'
import { clientIp, isInternal } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { getRegion } from '@/lib/weather'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { parsePeakQuery } from '@/lib/hike/params'
import { fetchSummitRaw } from '@/lib/hike/sources'
import { buildHike } from '@/lib/hike/build'
import featured from '@/lib/hike/featured.json'
import { lastUpstreamFailure } from '@/lib/outlook/http'
import { noStore } from '@/lib/no-store'

// Summit forecast for one peak: the outlook's models downscaled to its
// height. Language-neutral and CDN-cached per peak for an hour.

// an hour, then 30 minutes more while a new copy is built: at most 90 minutes old, as it was with
// 30 minutes and an hour (2026-11-10), so what reads it needs no change
const TTL = 3600, STALE = 1800
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 })

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
  // Open-Meteo hangs now and then on the full request: note how often
  if (!multi || multi.fallback) await logError('hike.upstream', new Error(multi ? 'fell back to the core models' : 'no summit forecast'), { upstream: lastUpstreamFailure() })
  // the grade of a listed summit sets how much daylight its descent keeps; the request has only coordinates
  const listed = featured.find(p => Math.round(p.lat * 1e3) / 1e3 === peak.lat && Math.round(p.lon * 1e3) / 1e3 === peak.lon)
  const payload = buildHike({ peak: { ...peak, grade: listed?.grade }, region, multi, weights })
  // Open-Meteo refused or dropped every request: say so with 200, never cached, so the peak view shows
  // its retry card instead of a server error; the summit pages, push dispatch and the widget treat it as missing
  if (!payload.hourly.length) return noStore({ ...payload, unavailable: true }, 200)

  return Response.json(payload, {
    headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${STALE}` },
  })
})

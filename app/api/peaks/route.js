import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import featured from '@/lib/hike/featured.json'
import { parseSearchQuery } from '@/lib/hike/params'
import { matchFeatured, parsePhoton, parseGeocodingPeaks, mergePeaks } from '@/lib/hike/search'
import { fetchPhotonRaw, fetchElevations, fetchGeocodingRaw } from '@/lib/hike/sources'

// Worldwide peak & hut search: featured Alps peaks first, then OpenStreetMap
// (Photon) with heights from the elevation service; Open-Meteo geocoding when
// Photon is down. Cached per query for a day — peaks don't move.
export const maxDuration = 15

const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('peaks', async (request) => {
  const query = parseSearchQuery(new URL(request.url).searchParams)
  if (!query) return noStore({ error: 'Search needs 2–80 characters.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const feat = matchFeatured(query.q, featured)
  let found = parsePhoton(await fetchPhotonRaw(query.q, query.bias ?? {}))
  let elevations = found?.length ? await fetchElevations(found) : []
  if (!found) {
    found = parseGeocodingPeaks(await fetchGeocodingRaw(query.q))
    elevations = []
  }
  if (!found && !feat.length) return noStore({ error: 'Search is unavailable right now — try a featured peak.' }, 502)

  return Response.json({ peaks: mergePeaks(feat, found ?? [], elevations) }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
})

import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import featured from '@/lib/hike/featured.json'
import { parseSearchQuery } from '@/lib/hike/params'
import { matchFeatured, parsePhoton, parseGeocodingPeaks, mergePeaks, searchMaxAge } from '@/lib/hike/search'
import { resolveHeights } from '@/lib/hike/heights'
import { fetchPhotonRaw, fetchOsmHeights, fetchElevations, fetchGeocodingRaw } from '@/lib/hike/sources'

// Worldwide peak & hut search: featured Alps peaks first, then OpenStreetMap
// (Photon) with OSM's surveyed heights (the terrain model only where OSM has
// none); Open-Meteo geocoding when Photon is down. Cached per query for a
// day — peaks don't move — or 5 minutes when a source was down.
export const maxDuration = 15

const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('peaks', async (request) => {
  const query = parseSearchQuery(new URL(request.url).searchParams)
  if (!query) return noStore({ error: 'Search needs 2–80 characters.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const feat = matchFeatured(query.q, featured)
  const photon = parsePhoton(await fetchPhotonRaw(query.q, query.bias ?? {}))
  const geo = photon ? null : parseGeocodingPeaks(await fetchGeocodingRaw(query.q))
  if (!photon && !geo && !feat.length) return noStore({ error: 'Search is unavailable right now — try a featured peak.' }, 502)

  const heights = photon
    ? await resolveHeights(photon, { osmEle: fetchOsmHeights, demEle: fetchElevations })
    : { peaks: geo ?? [], osmDown: false, demDown: false }
  const age = searchMaxAge({ photonDown: !photon, elevationsDown: heights.osmDown || heights.demDown })
  return Response.json({ peaks: mergePeaks(feat, heights.peaks) }, {
    headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
  })
})

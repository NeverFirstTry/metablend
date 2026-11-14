import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import featured from '@/lib/hike/featured.json'
import { parseSearchQuery } from '@/lib/hike/params'
import { matchFeatured, parseNominatim, parsePhoton, mergePeaks, searchMaxAge } from '@/lib/hike/search'
import { places } from '@/lib/places/server'
import { ownSearch, ownAnswers } from '@/lib/places/search'
import { resolveHeights } from '@/lib/hike/heights'
import { fetchNominatimSearchRaw, fetchPhotonRaw, fetchOsmHeights, fetchElevations, fetchSummitElevations } from '@/lib/hike/sources'
import { noStore } from '@/lib/no-store'

// Worldwide peak & hut search, from our own summits, huts and towns
// (supabase/places.sql) — as you type, too: featured peaks first, then
// summits and huts by name in any of our languages, and when the query names
// a town, what's within 25 km of it — what "Near you" would show standing
// there, and its nearest huts — nearest first, with the distance
// (lib/places/search.js). Heights from OpenStreetMap, the terrain model for
// the few shown without one. Only a search the user sends (full=1: Enter)
// goes outside, and only when our data can't answer or isn't loaded yet:
// Nominatim (never while typing: its policy), then Photon. No geocoder is
// asked (2026-11-12: Open-Meteo's is gone from the whole site). Cached per
// query for a day — peaks don't move — or 5 minutes when a source was down,
// ours included (the fallback's answer mustn't stick once ours is back).

const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
// a sent search can ask Nominatim three times (name, summits, huts around)
const sentLimiter = createRateLimiter({ max: 10, windowMs: 60 * 1000 })
const AROUND_KM = 25

export const GET = withErrorLog('peaks', async (request) => {
  const query = parseSearchQuery(new URL(request.url).searchParams)
  if (!query) return noStore({ error: 'Search needs 2-80 characters.' }, 400)
  const ip = clientIp(request)
  if (limiter.limited(ip) || (query.full && sentLimiter.limited(ip))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const feat = matchFeatured(query.q, featured)
  const ok = (body, age) => Response.json(body, {
    headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
  })
  let ownDown = true
  if (await places.ready()) {
    const own = await ownSearch(query, feat, { places, featured, demEle: fetchSummitElevations, km: AROUND_KM })
    // a sent search our data has nothing for: the outside services below
    if (ownAnswers(own, query.full)) return ok(own.body, own.age)
    ownDown = !own
  }
  // only reached when our data didn't answer. While typing nothing goes outside: the featured peaks, kept briefly
  if (!query.full) return ok({ peaks: mergePeaks(feat, []), around: null }, 300)
  const nominatim = await fetchNominatimSearchRaw(query.q, query.bias ?? {})
  let named = parseNominatim(nominatim), fromPhoton = false
  if (!named) { named = parsePhoton(await fetchPhotonRaw(query.q, query.bias ?? {})); fromPhoton = !!named }
  if (!named && !feat.length) return noStore({ error: 'Search is unavailable right now — try a featured peak.' }, 502)

  const heights = named
    ? await resolveHeights(named, { osmEle: fromPhoton ? fetchOsmHeights : async () => ({}), demEle: fetchElevations })
    : { peaks: [], osmDown: false, demDown: false }
  return ok({ peaks: mergePeaks(feat, heights.peaks), around: null }, ownDown ? 300 : searchMaxAge({ photonDown: !nominatim, elevationsDown: heights.osmDown || heights.demDown }))
})

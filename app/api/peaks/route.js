import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import featured from '@/lib/hike/featured.json'
import { parseSearchQuery } from '@/lib/hike/params'
import { matchFeatured, parseNominatim, parsePhoton, parseGeocodingPeaks, mergePeaks, searchMaxAge, placeOfQuery, aroundPlace, plainQuery, geocodeTown } from '@/lib/hike/search'
import { places } from '@/lib/places/server'
import { ownSearch, ownAnswers } from '@/lib/places/search'
import { resolveHeights } from '@/lib/hike/heights'
import { fetchNominatimSearchRaw, fetchNominatimNearRaw, fetchPhotonRaw, fetchOsmHeights, fetchElevations, fetchSummitElevations, fetchGeocodingRaw } from '@/lib/hike/sources'

// Worldwide peak & hut search, from our own summits, huts and towns
// (supabase/places.sql) — as you type, too: featured peaks first, then
// summits and huts by name in any of our languages, and when the query names
// a town, what's within 25 km of it — what "Near you" would show standing
// there, and its nearest huts — nearest first, with the distance
// (lib/places/search.js). Heights from OpenStreetMap, the terrain model for
// the few shown without one. Only a search the user sends (full=1: Enter)
// goes outside: the geocoder for a village too small for our towns, and —
// when our data can't answer, or isn't loaded yet — Nominatim (never while
// typing: its policy), then Photon, then the geocoder's mountains. Cached per
// query for a day — peaks don't move — or 5 minutes when a source was down.

const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
// a sent search can ask Nominatim three times (name, summits, huts around)
const sentLimiter = createRateLimiter({ max: 10, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const AROUND_KM = 25

export const GET = withErrorLog('peaks', async (request) => {
  const query = parseSearchQuery(new URL(request.url).searchParams)
  if (!query) return noStore({ error: 'Search needs 2–80 characters.' }, 400)
  const ip = clientIp(request)
  if (limiter.limited(ip) || (query.full && sentLimiter.limited(ip))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const feat = matchFeatured(query.q, featured)
  const ok = (body, age) => Response.json(body, {
    headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
  })
  if (await places.ready()) {
    const own = await ownSearch(query, feat, { places, featured, demEle: fetchSummitElevations, geocode: q => geocodeTown(q, fetchGeocodingRaw), km: AROUND_KM })
    // a sent search our data has nothing for: the outside services below
    if (ownAnswers(own, query.full)) return ok(own.body, own.age)
  }
  if (!query.full) {
    const typed = parseGeocodingPeaks(await fetchGeocodingRaw(query.q))
    const age = typed ? 86400 : 300
    return Response.json({ peaks: mergePeaks(feat, typed ?? []), around: null }, {
      headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
    })
  }
  // a town's name is also asked plain: "Hà Nội" is found only as "hanoi"
  const plain = plainQuery(query.q)
  const [nominatim, geo, geoPlain] = await Promise.all([
    fetchNominatimSearchRaw(query.q, query.bias ?? {}), fetchGeocodingRaw(query.q), plain !== query.q ? fetchGeocodingRaw(plain) : null,
  ])
  let named = parseNominatim(nominatim), fromPhoton = false
  if (!named) { named = parsePhoton(await fetchPhotonRaw(query.q, query.bias ?? {})); fromPhoton = !!named }
  const geoPeaks = named ? null : parseGeocodingPeaks(geo)

  // a city or town: what's around it
  const place = placeOfQuery({ results: [...(geo?.results ?? []), ...(geoPlain?.results ?? [])] }, query.q)
  let around = null, aroundDown = false
  if (place) {
    const peaks = parseNominatim(await fetchNominatimNearRaw(place.latitude, place.longitude, AROUND_KM, 'peak'))
    const huts = parseNominatim(await fetchNominatimNearRaw(place.latitude, place.longitude, AROUND_KM, 'alpine hut'))
    aroundDown = !peaks || !huts
    const h = await resolveHeights([...(peaks ?? []), ...(huts ?? [])], { osmEle: async () => ({}), demEle: fetchElevations })
    aroundDown ||= h.demDown
    around = { place: { name: place.name, region: place.admin1 ?? null, country: place.country_code ?? null }, peaks: aroundPlace(h.peaks, place) }
  }
  if (!named && !geoPeaks && !feat.length && !around?.peaks.length) return noStore({ error: 'Search is unavailable right now — try a featured peak.' }, 502)

  const heights = named
    ? await resolveHeights(named, { osmEle: fromPhoton ? fetchOsmHeights : async () => ({}), demEle: fetchElevations })
    : { peaks: geoPeaks ?? [], osmDown: false, demDown: false }
  const peaks = mergePeaks(feat, heights.peaks)
  if (around) around.peaks = around.peaks.filter(p => !peaks.some(q => q.id === p.id))
  const age = searchMaxAge({ photonDown: !nominatim || aroundDown, elevationsDown: heights.osmDown || heights.demDown })
  return Response.json({ peaks, around }, {
    headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
  })
})

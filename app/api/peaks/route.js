import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import featured from '@/lib/hike/featured.json'
import { parseSearchQuery } from '@/lib/hike/params'
import { matchFeatured, parseNominatim, parsePhoton, parseGeocodingPeaks, mergePeaks, searchMaxAge, placeOfQuery, aroundPlace, plainQuery, pickTown } from '@/lib/hike/search'
import { places } from '@/lib/places/server'
import { resolveHeights } from '@/lib/hike/heights'
import { fetchNominatimSearchRaw, fetchNominatimNearRaw, fetchPhotonRaw, fetchOsmHeights, fetchElevations, fetchGeocodingRaw } from '@/lib/hike/sources'

// Worldwide peak & hut search, from our own summits, huts and towns
// (supabase/places.sql) — as you type, too: featured peaks first, then
// summits and huts by name in any of our languages, and when the query names
// a town, what's within 25 km of it, nearest first, with the distance.
// Heights from OpenStreetMap, the terrain model for the few shown without
// one. Only a search the user sends (full=1: Enter) that our data can't
// answer — or our data not there yet — goes outside: Nominatim (never while
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
    const own = await ownSearch(query, feat)
    // a sent search our data has nothing for: the outside geocoder below
    if (own && !(query.full && !own.body.peaks.length && !own.body.around?.peaks.length)) return ok(own.body, own.age)
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

// Our own data: names, and a town the query names with what's around it.
async function ownSearch(query, feat) {
  const [named, towns] = await Promise.all([places.search(query.q, query.bias), places.towns(query.q)])
  if (!named) return null
  const town = pickTown(towns, query.q)
  const near = town ? await places.near(town.lat, town.lon, AROUND_KM, 12) : null
  const h = await resolveHeights([...named, ...(near ?? [])], { osmEle: async () => ({}), demEle: fetchElevations })
  const byId = new Map(h.peaks.map(p => [p.id, p]))
  const peaks = mergePeaks(feat, named.map(p => byId.get(p.id)))
  const around = town ? {
    place: { name: town.name, region: town.region, country: town.country },
    peaks: aroundPlace((near ?? []).map(p => byId.get(p.id)), { latitude: town.lat, longitude: town.lon }).filter(p => !peaks.some(q => q.id === p.id)),
  } : null
  return { body: { peaks, around }, age: h.demDown || (town && !near) ? 300 : 86400 }
}

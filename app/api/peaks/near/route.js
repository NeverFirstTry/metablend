import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { haversineKm } from '@/lib/geo'
import { parsePhoton, parseNominatim } from '@/lib/hike/search'
import { resolveHeights, withNotability } from '@/lib/hike/heights'
import { fetchNominatimNearRaw, fetchPhotonNearRaw, fetchOsmTags, fetchElevations } from '@/lib/hike/sources'
import { nearCell, uniqueById } from '@/lib/hike/near'
import { places } from '@/lib/places/server'

// GET /api/peaks/near?lat=46.85&lon=12.75 → the summits around a spot for the
// Hiking screen's "Near you": named summits with a height within 50 km, with
// how notable OpenStreetMap marks them — the phone picks the ten from its own
// position (lib/hike/near.js pickNearPeaks). From our own summits
// (supabase/places.sql summits_pool: the nearest within 15 km and the most
// notable within 50 km); while that isn't there, or fails, OpenStreetMap via
// Nominatim (the 40 most important within 50 and 15 km), then Photon.
// One answer per ~5 km cell, CDN-cached for a day — summits don't move.

const limiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
// the terrain model takes at most 100 points per call; it's only the fallback
const demEle = async points => {
  const got = await fetchElevations(points.slice(0, 100))
  return got && points.map((_, i) => got[i] ?? null)
}

export const GET = withErrorLog('peaks.near', async (request) => {
  const sp = new URL(request.url).searchParams
  const num = k => (sp.get(k) ? Number(sp.get(k)) : Number.NaN)
  const cell = nearCell(num('lat'), num('lon'))
  if (!cell) return noStore({ error: 'Needs lat and lon.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const cache = age => ({ 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` })
  const pool = (await places.ready()) ? await places.pool(cell.lat, cell.lon) : null
  if (pool) {
    // the few without a height from OpenStreetMap: the terrain model
    const own = await resolveHeights(pool, { osmEle: async () => ({}), demEle })
    const summits = own.peaks.filter(p => p.name && Number.isFinite(p.elev))
    return Response.json({ cell, summits }, { headers: cache(own.demDown ? 300 : 86400) })
  }

  const wide = parseNominatim(await fetchNominatimNearRaw(cell.lat, cell.lon, 50))
  const close = parseNominatim(await fetchNominatimNearRaw(cell.lat, cell.lon, 15))
  let found, heights, notability = null
  if (wide || close) {
    found = uniqueById([...(close ?? []), ...(wide ?? [])])
    heights = await resolveHeights(found, { osmEle: async () => ({}), demEle })
  } else {
    const photon = parsePhoton(await fetchPhotonNearRaw(cell.lat, cell.lon, 50))
    if (!photon) return noStore({ error: 'Nearby summits are unavailable right now.' }, 502)
    found = photon.filter(p => p.kind === 'peak')
    const tags = found.length ? await fetchOsmTags(found) : { ele: {}, notability: {} }
    heights = await resolveHeights(found, { osmEle: async () => tags?.ele ?? null, demEle })
    notability = tags?.notability ?? null
  }
  const summits = withNotability(heights.peaks, notability)
    .filter(p => p.name && Number.isFinite(p.elev) && haversineKm(cell.lat, cell.lon, p.lat, p.lon) <= 50)

  // an incomplete answer (one box, the fallback or the heights failed) mustn't stick
  const age = !wide || !close || heights.osmDown || heights.demDown ? 300 : 86400
  return Response.json({ cell, summits }, {
    headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
  })
})

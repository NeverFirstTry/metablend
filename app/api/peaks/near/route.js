import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { haversineKm } from '@/lib/geo'
import { parsePhoton } from '@/lib/hike/search'
import { resolveHeights, withNotability } from '@/lib/hike/heights'
import { fetchPhotonNearRaw, fetchOsmTags, fetchElevations } from '@/lib/hike/sources'
import { nearCell, ringPoints, samplePoints } from '@/lib/hike/near'

// GET /api/peaks/near?lat=46.85&lon=12.75 → the summits around a spot for the
// Hiking screen's "Near you": every named summit with a height within 50 km,
// with how notable OpenStreetMap marks it — the phone picks the ten from its
// own position (lib/hike/near.js pickNearPeaks). OpenStreetMap is asked at
// the spot and on a 12 km ring (it answers with the 50 nearest, which in the
// mountains are all within a few km), each point once more if it fails;
// heights as for a search. One answer per ~5 km cell, CDN-cached for a day —
// summits don't move.
export const maxDuration = 20

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

  const points = [cell, ...ringPoints(cell, 12, 6)]
  // the centre looks out to 50 km (flat country), the ring to 20 km
  const lists = (await samplePoints(points, (p, i) => fetchPhotonNearRaw(p.lat, p.lon, i === 0 ? 50 : 20).then(parsePhoton))).filter(Boolean)
  if (!lists.length) return noStore({ error: 'Nearby summits are unavailable right now.' }, 502)

  const byId = new Map()
  for (const list of lists) for (const p of list) if (p.kind === 'peak') byId.set(p.id, p)
  const found = [...byId.values()]
  const tags = found.length ? await fetchOsmTags(found) : { ele: {}, notability: {} }
  const heights = await resolveHeights(found, { osmEle: async () => tags?.ele ?? null, demEle })
  const summits = withNotability(heights.peaks, tags?.notability)
    .filter(p => p.name && Number.isFinite(p.elev) && haversineKm(cell.lat, cell.lon, p.lat, p.lon) <= 50)

  // an incomplete answer (a sample point or the heights failed) mustn't stick
  const age = lists.length < points.length || heights.osmDown ? 300 : 86400
  return Response.json({ cell, summits }, {
    headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
  })
})

import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import featured from '@/lib/hike/featured.json'
import { parsePhoton } from '@/lib/hike/search'
import { resolveHeights } from '@/lib/hike/heights'
import { fetchPhotonNearRaw, fetchOsmHeights, fetchElevations } from '@/lib/hike/sources'
import { nearCell, ringPoints, pickNearPeaks } from '@/lib/hike/near'

// GET /api/peaks/near?lat=46.85&lon=12.75 → the notable summits around a spot
// for the Hiking screen's "Near you" (lib/hike/near.js). OpenStreetMap is
// asked at the spot and on a 12 km ring (it answers with the 50 nearest, which
// in the mountains are all within a few km), heights as for a search. One
// answer per ~5 km cell, CDN-cached for a day — summits don't move.
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
  const raws = await Promise.all(points.map((p, i) => fetchPhotonNearRaw(p.lat, p.lon, i === 0 ? 50 : 20)))
  const lists = raws.map(parsePhoton).filter(Boolean)
  if (!lists.length) return noStore({ error: 'Nearby summits are unavailable right now.' }, 502)

  const byId = new Map()
  for (const list of lists) for (const p of list) if (p.kind === 'peak') byId.set(p.id, p)
  const heights = await resolveHeights([...byId.values()], { osmEle: fetchOsmHeights, demEle })
  const peaks = pickNearPeaks(heights.peaks, featured, cell)

  // an incomplete answer (a sample point or the heights failed) mustn't stick
  const age = lists.length < raws.length || heights.osmDown ? 300 : 86400
  return Response.json({ cell, peaks }, {
    headers: { 'Cache-Control': `public, s-maxage=${age}, stale-while-revalidate=${age === 86400 ? 604800 : age}` },
  })
})

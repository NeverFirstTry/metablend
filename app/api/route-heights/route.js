import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { fetchElevations } from '@/lib/hike/sources'
import { parseHeightsBody } from '@/lib/route/validate'
import { fillHeights, hasHeights } from '@/lib/route/heights'

// A saved route's missing heights from the terrain model — the app fills its
// older saved routes once (lib/route-store.js repairHeights).
// POST /api/route-heights { points: [[lat, lon, ele|null]…] }  →  { points, heights }

const limiter = createRateLimiter({ max: 10, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const POST = withErrorLog('route-heights', async (request) => {
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const q = parseHeightsBody(await request.json().catch(() => null))
  if (!q.ok) return noStore({ error: q.error }, 400)
  const { points } = await fillHeights(q.value.points, fetchElevations)
  return noStore({ points: points.map(p => [p.lat, p.lon, p.ele == null ? null : Math.round(p.ele)]), heights: hasHeights(points) }, 200)
})

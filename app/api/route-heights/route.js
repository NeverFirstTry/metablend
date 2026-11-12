import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { fetchElevations } from '@/lib/hike/sources'
import { parseHeightsBody } from '@/lib/route/validate'
import { hasHeights } from '@/lib/route/heights'
import { routeHeights, dailyBudget } from '@/lib/route/height-store'
import { supabase } from '@/lib/supabase'
import { noStore } from '@/lib/no-store'

// A saved route's missing heights from the terrain model — the app fills its
// older saved routes once (lib/route-store.js repairHeights).
// POST /api/route-heights { points: [[lat, lon, ele|null]…] }  →  { points, heights }

const limiter = createRateLimiter({ max: 10, windowMs: 60 * 1000 })
// The same store as the listed routes: at most 100 points of a saved route are asked, once per line (kept
// under the id 'saved' and the line's fingerprint), the rest lie between them. Its own kind and its own
// daily budget: anyone can post here, and this must not use up what the listed routes may ask.
const budget = dailyBudget(supabase, { kind: 'saved-heights', limit: Number(process.env.OPEN_METEO_SAVED_POINTS) || 1000 })

export const POST = withErrorLog('route-heights', async (request) => {
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const q = parseHeightsBody(await request.json().catch(() => null))
  if (!q.ok) return noStore({ error: q.error }, 400)
  const { points } = await routeHeights('saved', q.value.points, { db: supabase, getElevations: pts => fetchElevations(pts, { kind: 'saved-heights' }), budget })
  return noStore({ points: points.map(p => [p.lat, p.lon, p.ele == null ? null : Math.round(p.ele)]), heights: hasHeights(points) }, 200)
})

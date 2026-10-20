import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import regionData from '@/lib/avalanche/regions.json'
import { avalancheLevel, bulletinDates } from '@/lib/avalanche/avalanche'
import { ratingsFor } from '@/lib/avalanche/fetch'

// GET /api/avalanche?lat=47.07&lon=12.69 → { region, today, tomorrow, dates }:
// the official avalanche danger level (1–5) of the spot's avalanche region
// today and tomorrow — null when there's no rating (no avalanche region
// there, out of season, or tomorrow's bulletin isn't out yet; they come
// around 17:00). The day's ratings file is cached 30 minutes, the answer too.
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('avalanche', async (request) => {
  const sp = new URL(request.url).searchParams
  const num = k => (sp.get(k) ? Number(sp.get(k)) : Number.NaN)
  const lat = num('lat'), lon = num('lon')
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return noStore({ error: 'Needs lat and lon.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const dates = bulletinDates()
  const [a, b] = await Promise.all([ratingsFor(dates.today), ratingsFor(dates.tomorrow)])
  const today = avalancheLevel(regionData, a, lat, lon), tomorrow = avalancheLevel(regionData, b, lat, lon)
  return Response.json(
    { region: today?.region ?? tomorrow?.region ?? null, today: today?.level ?? null, tomorrow: tomorrow?.level ?? null, dates },
    { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=1800' } },
  )
})

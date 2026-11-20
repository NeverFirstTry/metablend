import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import regionData from '@/lib/avalanche/regions.json'
import { avalancheAnswer, bulletinDates } from '@/lib/avalanche/avalanche'
import { ratingsRead } from '@/lib/avalanche/fetch'
import { noStore } from '@/lib/no-store'

// GET /api/avalanche?lat=47.07&lon=12.69 → { region, today, tomorrow, dates }:
// the official avalanche danger level (1–5) of the spot's avalanche region
// today and tomorrow — null when there's no rating (no avalanche region
// there, out of season, or tomorrow's bulletin isn't out yet; they come
// around 17:00). The day's ratings file is cached 30 minutes, the answer too.
// When today's file could not be read, `unavailable: true`, kept one minute.
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })

export const GET = withErrorLog('avalanche', async (request) => {
  const sp = new URL(request.url).searchParams
  const num = k => (sp.get(k) ? Number(sp.get(k)) : Number.NaN)
  const lat = num('lat'), lon = num('lon')
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return noStore({ error: 'Needs lat and lon.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const dates = bulletinDates()
  const [a, b] = await Promise.all([ratingsRead(dates.today), ratingsRead(dates.tomorrow)])
  const { body, maxAge } = avalancheAnswer(regionData, a, b, lat, lon, dates)
  return Response.json(body, { headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` } })
})

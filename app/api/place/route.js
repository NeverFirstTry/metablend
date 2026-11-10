import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { pickLang } from '@/lib/share'
import { parseNear } from '@/lib/geo'
import { placeNear } from '@/lib/geocode'
import { noStore } from '@/lib/no-store'

// GET /api/place?near=46.8,12.8&lang=de → { name }: the place "My location" shows. The phone sends its
// position already rounded to 0.1°, about 10 km (lib/geo.js placeAt), and parseNear rounds again, so
// nothing finer is ever looked up or passed on; a failed request's log drops `near` (lib/log-url.js).
// Our own towns answer, OpenStreetMap's Nominatim where none is in reach (lib/geocode.js placeNear).
// One answer per rounded position and language, kept a day by the CDN: towns don't move.
const DAY = 86400
const limiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })

export const GET = withErrorLog('place', async (request) => {
  const sp = new URL(request.url).searchParams
  const near = parseNear(sp.get('near'))
  if (!near) return noStore({ error: 'Needs near=lat,lon.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const place = await placeNear(near, pickLang(sp.get('lang')))
  if (!place) return noStore({ error: 'No place found there.' }, 404)
  return Response.json(place, { headers: { 'Cache-Control': `public, s-maxage=${DAY}, stale-while-revalidate=${DAY * 7}` } })
})

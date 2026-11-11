import { loadClimate } from '@/lib/climate-store'
import { geocodeCity } from '@/lib/geocode'
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { noStore } from '@/lib/no-store'

// Per-month climate normals (avg temp + rainy days) from ~10 years of ERA5 data.
// They come from the place's climate table, which is asked from Open-Meteo once a
// year and kept in the database (lib/climate-store.js): a 10-year request weighs
// about 104 calls against their quota. The CDN keeps each city's answer for a day.
const DAY = 86400
const limiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })

export const GET = withErrorLog('planner', async (request) => {
  const city = (new URL(request.url).searchParams.get('city') ?? '').trim()
  if (!city || city.length > 100) return noStore({ error: 'No city specified' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const geo = await geocodeCity(city)
  if (!geo) return noStore({ error: `"${city}" was not found.` }, 404)

  const months = (await loadClimate(geo.lat, geo.lon))?.months
  if (!months) return noStore({ error: 'Historical data unavailable' }, 502)

  return Response.json({ city: geo.name, country: geo.country, cc: geo.cc ?? null, months }, {
    headers: { 'Cache-Control': `public, s-maxage=${DAY}, stale-while-revalidate=${DAY * 7}` },
  })
})

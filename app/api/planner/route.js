import { geocodeCity } from '@/lib/weather'
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'

// Per-month climate normals (avg temp + rainy days) from ~10 years of ERA5 data.
// Climate doesn't change within a day: the CDN keeps each city's answer for a
// day and Next's fetch cache keeps the archive response, because a 10-year
// request counts as many calls against Open-Meteo's quota.
const DAY = 86400
const limiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('planner', async (request) => {
  const city = (new URL(request.url).searchParams.get('city') ?? '').trim()
  if (!city || city.length > 100) return noStore({ error: 'No city specified' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const geo = await geocodeCity(city)
  if (!geo) return noStore({ error: `"${city}" was not found.` }, 404)

  const endYear = new Date().getFullYear() - 1
  const startYear = endYear - 9
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${geo.lat}&longitude=${geo.lon}&start_date=${startYear}-01-01&end_date=${endYear}-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`

  const res = await fetch(url, { next: { revalidate: DAY }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) return noStore({ error: 'Historical data unavailable' }, 502)
  const day = (await res.json()).daily
  if (!day?.time) return noStore({ error: 'No historical data' }, 502)

  // accumulate per calendar month
  const tSum = Array(12).fill(0), tN = Array(12).fill(0), rainy = Array(12).fill(0)
  const yearsPerMonth = Array.from({ length: 12 }, () => new Set())

  day.time.forEach((d, i) => {
    const m = parseInt(d.slice(5, 7)) - 1
    const year = d.slice(0, 4)
    yearsPerMonth[m].add(year)
    const t = day.temperature_2m_mean[i]
    const p = day.precipitation_sum[i]
    if (t != null) { tSum[m] += t; tN[m]++ }
    if (p != null && p >= 1) rainy[m]++
  })

  const months = Array.from({ length: 12 }, (_, m) => ({
    month: m + 1,
    avgTemp: tN[m] ? Math.round(tSum[m] / tN[m] * 10) / 10 : null,
    avgRainDays: yearsPerMonth[m].size ? Math.round(rainy[m] / yearsPerMonth[m].size) : null,
  }))

  return Response.json({ city: geo.name, country: geo.country, months }, {
    headers: { 'Cache-Control': `public, s-maxage=${DAY}, stale-while-revalidate=${DAY * 7}` },
  })
})

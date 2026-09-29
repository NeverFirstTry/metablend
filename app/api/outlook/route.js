import { withErrorLog, logError } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { geocodeCity, getRegion } from '@/lib/weather'
import { fetchOpenMeteoMultiRaw, fetchEnsembleRaw, fetchClimateRaw } from '@/lib/outlook/sources'
import { fetchNationalRaw, fetchMetNorwayRaw } from '@/lib/outlook/national'
import { buildOutlook } from '@/lib/outlook/build'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { saveSnapshots } from '@/lib/outlook/snapshots'

// The future forecast: 48 h / 7 days / 14 days consensus + headlines.
// Language-neutral on purpose — every visitor of a city shares one CDN copy
// for 30 minutes, so 1 or 1,000 viewers cost the same upstream calls.
export const maxDuration = 30

const TTL = 1800
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('outlook', async (request) => {
  const q = new URL(request.url).searchParams.get('city')?.trim()
  if (!q) return noStore({ error: 'No city specified' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const geo = await geocodeCity(q, 'en')
  if (!geo) return noStore({ error: `"${q}" was not found.` }, 404)
  const region = getRegion(geo.lat, geo.lon)

  const [multi, ensemble, climate, national, weights] = await Promise.all([
    fetchOpenMeteoMultiRaw(geo.lat, geo.lon),
    fetchEnsembleRaw(geo.lat, geo.lon),
    fetchClimateRaw(geo.lat, geo.lon),
    fetchNationalRaw(geo.lat, geo.lon),
    loadOutlookWeights(region),
  ])
  // MET Norway only as the fallback when the model request failed
  const met = multi ? null : await fetchMetNorwayRaw(geo.lat, geo.lon)

  const { payload, series, utcOffsetSec, todayLocal } = buildOutlook({ geo, region, multi, ensemble, climate, national, met, weights })
  if (!payload.hourly.length && !payload.days.length) {
    return noStore({ error: 'Forecast unavailable right now — please try again shortly.' }, 502)
  }

  // Learning must never break the forecast itself
  try {
    await saveSnapshots({ city: geo.name, lat: geo.lat, lon: geo.lon, region, series, utcOffsetSec, todayLocal })
  } catch (e) {
    await logError('outlook.snapshot', e, { city: geo.name })
  }

  return Response.json(payload, {
    headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` },
  })
})

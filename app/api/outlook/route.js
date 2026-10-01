import { withErrorLog, logError } from '@/lib/log'
import { clientIp, isInternal } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { geocodeCity, englishPlaceName, getRegion } from '@/lib/weather'
import { pickLang } from '@/lib/share'
import { fetchOpenMeteoMultiRaw, fetchClimateRaw } from '@/lib/outlook/sources'
import { fetchNationalRaw, fetchMetNorwayRaw } from '@/lib/outlook/national'
import { buildOutlook } from '@/lib/outlook/build'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { saveSnapshots } from '@/lib/outlook/snapshots'
import { lastUpstreamFailure } from '@/lib/outlook/http'

// The future forecast: today, tomorrow and the week — consensus + headlines.
// Language-neutral on purpose — every visitor of a city shares one CDN copy
// for 30 minutes, so 1 or 1,000 viewers cost the same upstream calls.
export const maxDuration = 30

const TTL = 1800
const limiter = createRateLimiter({ max: 40, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('outlook', async (request) => {
  const sp = new URL(request.url).searchParams
  const q = sp.get('city')?.trim()
  if (!q) return noStore({ error: 'No city specified' }, 400)
  // the place is looked up in the visitor's language, like /api/forecast does —
  // in English, "Wien" is a town in Missouri, not Vienna
  const lang = pickLang(sp.get('lang'))
  // only cache misses reach this point — CDN hits never invoke the function
  if (!isInternal(request) && limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)

  const geo = await geocodeCity(q, lang)
  if (!geo) return noStore({ error: `"${q}" was not found.` }, 404)
  const region = getRegion(geo.lat, geo.lon)

  const [multi, climate, national, weights, learnName] = await Promise.all([
    fetchOpenMeteoMultiRaw(geo.lat, geo.lon),
    fetchClimateRaw(geo.lat, geo.lon),
    fetchNationalRaw(geo.lat, geo.lon),
    loadOutlookWeights(region),
    lang === 'en' ? geo.name : englishPlaceName(geo.id),
  ])
  // MET Norway only as the fallback when the model request failed
  const met = multi ? null : await fetchMetNorwayRaw(geo.lat, geo.lon)

  const { payload, series, utcOffsetSec, todayLocal } = buildOutlook({ geo, region, multi, climate, national, met, weights })
  if (!payload.hourly.length && !payload.days.length) {
    return noStore({ error: 'Forecast unavailable right now — please try again shortly.', upstream: lastUpstreamFailure() }, 502)
  }

  // Learning must never break the forecast itself. Snapshots are keyed by the
  // English name; without one (lookup failed) this round is skipped rather
  // than filed under a second name for the same city.
  try {
    if (learnName) await saveSnapshots({ city: learnName, lat: geo.lat, lon: geo.lon, region, series, utcOffsetSec, todayLocal })
  } catch (e) {
    await logError('outlook.snapshot', e, { city: learnName })
  }

  return Response.json(payload, {
    headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` },
  })
})

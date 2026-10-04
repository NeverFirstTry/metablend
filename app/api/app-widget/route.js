import { withErrorLog } from '@/lib/log'
import { clientIp, selfBase } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { hikeApiPath } from '@/lib/hike/params'
import { parseAppWidgetQuery, weatherPayload, hikePayload } from '@/lib/app-widget'

// The home-screen widgets' feed: the forecast, outlook and summit forecast
// the app shows, read through the public domain (the CDN copies — 1 or
// 10,000 widgets cost the same) and boiled down to ~1 KB of display text.
// GET /api/app-widget?city=Lienz&lang=de&unit=C
// GET /api/app-widget?kind=hike&name=…&lat=…&lon=…&elev=…&date=YYYY-MM-DD&lang=de&unit=C
export const maxDuration = 30

const TTL = 900
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
// the public domain, not the deployment URL (deployment protection 401s
// server-to-server fetches) — same rule as /api/og/city
const baseFor = selfBase

async function getJson(url) {
  const key = process.env.CALIBRATE_SECRET
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: key ? { 'x-calibrate-key': key } : {} })
    const json = r.ok ? await r.json() : null
    return { status: r.status, json: json?.error ? null : json }
  } catch {
    return { status: 504, json: null }
  }
}

export const GET = withErrorLog('app-widget', async (request) => {
  const q = parseAppWidgetQuery(new URL(request.url).searchParams)
  if (!q) return noStore({ error: 'Invalid query' }, 400)
  // only cache misses reach this point — CDN hits never invoke the function
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests' }, 429)
  const base = baseFor(request)

  let body
  if (q.kind === 'hike') {
    const hike = await getJson(`${base}${hikeApiPath(q.peak)}`)
    if (!hike.json) return noStore({ error: 'Summit forecast unavailable' }, 502)
    body = hikePayload({ hike: hike.json, peak: q.peak, date: q.date, lang: q.lang, unit: q.unit })
    if (!body) return noStore({ error: 'No summit forecast for that day' }, 404)
  } else {
    const key = encodeURIComponent(q.city.toLowerCase())
    const [forecast, outlook] = await Promise.all([
      getJson(`${base}/api/forecast?city=${key}&lang=${q.lang}`),
      getJson(`${base}/api/outlook?city=${key}&lang=${q.lang}`),
    ])
    if (forecast.status === 404 || outlook.status === 404) return noStore({ error: 'City not found' }, 404)
    if (!forecast.json || !outlook.json?.nowLocal) return noStore({ error: 'Forecast unavailable' }, 502)
    const nc = await getJson(`${base}/api/nowcast?lat=${forecast.json.lat}&lon=${forecast.json.lon}`) // failing: json null, text unchanged
    body = weatherPayload({ forecast: forecast.json, outlook: outlook.json, lang: q.lang, unit: q.unit, nowcast: nc.json })
  }
  return Response.json(body, { headers: { 'Cache-Control': `public, s-maxage=${TTL}, stale-while-revalidate=${TTL * 2}` } })
})

import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { supabase } from '@/lib/supabase'
import { pickLang } from '@/lib/share'
import regionData from '@/lib/warnings/regions.json'
import { warningsIn, warningsAtPoint } from '@/lib/warnings/store'
import { lookupWarnings } from '@/lib/warnings/lookup'
import { sortWarnings, warningText } from '@/lib/warnings/text'

// GET /api/warnings?lat=48.21&lon=16.37&lang=de → the official warnings at
// that point, most serious first. covered: false outside MeteoAlarm's
// regions (the page then shows nothing). CDN-cached 5 minutes per URL —
// the page rounds the position to ~1 km.
const limiter = createRateLimiter({ max: 60, windowMs: 60 * 1000 })
const noStore = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = withErrorLog('warnings', async (request) => {
  const sp = new URL(request.url).searchParams
  const num = k => (sp.get(k) ? Number(sp.get(k)) : Number.NaN)
  const lat = num('lat'), lon = num('lon')
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return noStore({ error: 'Needs lat and lon.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests — please slow down.' }, 429)
  const lang = pickLang(sp.get('lang'))
  const cc = /^[a-z]{2}$/i.test(sp.get('cc') ?? '') ? sp.get('cc').toUpperCase() : null // the place's country, when known
  const found = await lookupWarnings(lat, lon, cc, {
    regionData, inRegions: ids => warningsIn(supabase, ids), atPoint: (la, lo) => warningsAtPoint(supabase, la, lo),
  })
  const warnings = sortWarnings(found.warnings).map(w => ({
    id: w.id, level: w.level, type: w.type, onset: w.onset, expires: w.expires,
    sender: w.sender, web: w.web, text: warningText(w, lang),
  }))
  return Response.json({ covered: found.covered, warnings }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } })
})

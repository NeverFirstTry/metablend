import { supabase } from '@/lib/supabase'
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { pickLang } from '@/lib/share'
import { noStore } from '@/lib/no-store'
import { townResult, nameIn } from '@/lib/geocode'

// Place suggestions for the search boxes (the forecast's and the notification settings'), from our own
// towns: nothing a visitor types goes to an outside service. The answer has the shape the boxes already
// read ({ results: [{ id, name, admin1, country, country_code, latitude, longitude }] }); the name is the
// town's in the reader's language. Towns do not move: the CDN keeps an answer a day per text and language.
// GET /api/places/search?q=&lang=

const limiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 }) // a box asks at most four times a second while typing

export const GET = withErrorLog('place-search', async (request) => {
  const sp = new URL(request.url).searchParams
  const q = (sp.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 80) return noStore({ error: 'Search needs 2 to 80 characters.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests. Please slow down.' }, 429)
  const lang = pickLang(sp.get('lang'))
  const { data, error } = await supabase.rpc('towns_search', { q, lim: 5 })
  if (error) return noStore({ error: 'The place search is unavailable right now.' }, 502)
  const results = (data ?? []).map(t => {
    const r = townResult(t)
    return { id: r.id, name: nameIn(t, lang), admin1: r.admin1, country: r.country, country_code: r.country_code, latitude: r.latitude, longitude: r.longitude }
  })
  return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
})

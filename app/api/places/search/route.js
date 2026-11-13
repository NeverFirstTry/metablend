import { supabase } from '@/lib/supabase'
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { pickLang } from '@/lib/share'
import { noStore } from '@/lib/no-store'
import { townResult, nameIn } from '@/lib/geocode'
import { regionIn } from '@/lib/places/regions'
import { placeKey } from '@/lib/weather'

// Place suggestions for the search boxes (the forecast's and the notification settings'), from our own
// towns: nothing a visitor types goes to an outside service. The answer has the shape the boxes already
// read ({ results: [{ id, name, admin1, country, country_code, latitude, longitude }] }); the name is the
// town's in the reader's language, and so is its region where GeoNames marks one (lib/places/regions.js).
// The database offers up to twenty towns: those of that name, those one of whose names begins so (the
// biggest first), then look-alikes (towns_search). A town matches by any of its names, in any language,
// so the five shown are picked for the reader: first the towns whose name as this reader sees it is, or
// begins with, what was typed ("vie" in English: Vienna before a Paris district once filed as "VIe"), and
// with them a city typed under its name in another language when it is the biggest by that name.
// Towns do not move: the CDN keeps an answer a day per text and language.
// GET /api/places/search?q=&lang=

const limiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 }) // a box asks at most four times a second while typing
const SHOWN = 5

export const GET = withErrorLog('place-search', async (request) => {
  const sp = new URL(request.url).searchParams
  const q = (sp.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 80) return noStore({ error: 'Search needs 2 to 80 characters.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests. Please slow down.' }, 429)
  const lang = pickLang(sp.get('lang'))
  const { data, error } = await supabase.rpc('towns_search', { q, lim: 20 })
  if (error) return noStore({ error: 'The place search is unavailable right now.' }, 502)
  const typed = placeKey(q)
  const people = t => t.population ?? 0
  const found = (data ?? []).map((t, i) => { const name = nameIn(t, lang), k = placeKey(name); return { t, i, name, is: k === typed, begins: k.startsWith(typed) } })
  // the biggest town this reader sees under the text
  const biggest = Math.max(0, ...found.filter(f => f.begins).map(f => people(f.t)))
  // 0: the town is called so, as the reader sees it, or by another of its names when it is bigger than every
  //    town the reader sees under the text ("Wien" in English is Vienna, not Wiener Neustadt; "Munich" in
  //    German is München, not a hamlet called Münichsthal). 1: its name as the reader sees it begins so.
  // 2: the rest, in the database's order.
  const rank = f => (f.is || (f.t.exact && people(f.t) > biggest) ? 0 : f.begins ? 1 : 2)
  const results = found
    .map(f => ({ ...f, rank: rank(f) }))
    .sort((a, b) => a.rank - b.rank || (a.rank < 2 ? people(b.t) - people(a.t) : 0) || a.i - b.i) // the biggest first within the first two groups
    .slice(0, SHOWN)
    .map(({ t, name }) => {
      const r = townResult(t)
      return { id: r.id, name, admin1: regionIn(r.country_code, r.admin1, lang), country: r.country, country_code: r.country_code, latitude: r.latitude, longitude: r.longitude }
    })
  return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
})

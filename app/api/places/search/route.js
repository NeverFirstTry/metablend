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
// with them a town typed under its name in another of our languages; among those the biggest first, an
// exact name counting for more.
// Towns do not move: the CDN keeps an answer a day per text and language.
// GET /api/places/search?q=&lang=

const limiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 }) // a box asks at most four times a second while typing
const SHOWN = 5
const EXACT = 1.5 // on the logarithm of the population: a factor of about thirty

export const GET = withErrorLog('place-search', async (request) => {
  const sp = new URL(request.url).searchParams
  const q = (sp.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 80) return noStore({ error: 'Search needs 2 to 80 characters.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests. Please slow down.' }, 429)
  const lang = pickLang(sp.get('lang'))
  const { data, error } = await supabase.rpc('towns_search', { q, lim: 20 })
  if (error) return noStore({ error: 'The place search is unavailable right now.' }, 502)
  const typed = placeKey(q)
  const found = (data ?? []).map((t, i) => {
    const name = nameIn(t, lang)
    // called exactly so: as this reader sees it, by its main name, or by its name in another of our languages
    // ("Wien" in English is Vienna, "Munich" in German is München). A name from the list's loose spellings
    // does not count: a Paris district is filed under "VIe" there.
    const called = [name, t.name, ...Object.values(t.names ?? {})].some(n => placeKey(n) === typed)
    const named = called || placeKey(name).startsWith(typed)
    // by size, and a town called exactly so counts like one about thirty times its size: "Wil" (24,000)
    // before Wilmington, but three hamlets called "Inn" (89, 22 and 20 people) not before Innsbruck
    return { t, i, name, named, weight: Math.log10((t.population ?? 0) + 10) + (called ? EXACT : 0) }
  })
  const results = found
    .sort((a, b) => b.named - a.named || (a.named ? b.weight - a.weight : 0) || a.i - b.i) // the rest keep the database's order
    .slice(0, SHOWN)
    .map(({ t, name }) => {
      const r = townResult(t)
      return { id: r.id, name, admin1: regionIn(r.country_code, r.admin1, lang), country: r.country, country_code: r.country_code, latitude: r.latitude, longitude: r.longitude }
    })
  return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
})

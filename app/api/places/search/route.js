import { supabase } from '@/lib/supabase'
import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { pickLang } from '@/lib/share'
import { noStore } from '@/lib/no-store'
import { townResult, nameIn } from '@/lib/geocode'
import { regionIn } from '@/lib/places/regions'
import { placeKey } from '@/lib/weather'
import { normalize } from '@/lib/hike/search'

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
// Summits, for the forecast's box only (summits=1; owner, 2026-11-13: "Großglockner" showed nothing until
// Enter, so people think we do not have it). They come from the summit search the hiking page uses, our own
// table. A summit is offered when its name, as the reader sees it, is the text, begins with it or holds it
// ("Glockner" in Großglockner), the best known first. When no town fits the text the summits come first,
// three at most; else below the towns that fit, two at most, and only for a whole name or five letters and
// more ("Inn" is on its way to Innsbruck). Never a summit whose name a town carries: for that name the
// forecast opens the town (lib/geocode.js), and a suggestion must open what it says. A summit shows its
// height and no region or country: the table's are wrong for some well-known peaks (lib/geocode.js).
// Towns do not move: the CDN keeps an answer a day per text and language.
// GET /api/places/search?q=&lang=[&summits=1]

const limiter = createRateLimiter({ max: 120, windowMs: 60 * 1000 }) // a box asks at most four times a second while typing
const SHOWN = 5
const EXACT = 1.5 // on the logarithm of the population: a factor of about thirty
const SUMMITS_ALONE = 3, SUMMITS_BELOW = 2
const peakKey = s => normalize(s) || placeKey(s) // as the summit search compares names ("ß" is "ss"); other scripts as they are

// the summits whose name fits the text, the best known first: at most four, each checked against the towns
async function summitsFor(rows, q, lang, belowTowns) {
  const typed = peakKey(q)
  const letter = q.trim().toLowerCase()
  // a peak we can place and tell apart: one with a height, near a town of our list
  const fit = rows.filter(s => s.kind === 'peak' && s.ele != null && s.country).map(s => {
    const name = s.names?.[lang] ?? s.name, k = peakKey(name)
    // 0: the name is the text, 1: it begins so, 2: one of its words begins so, 3: it holds the text, from
    // six letters on ("glockner" in Großglockner; "eiger" would bring Hochzeiger)
    const how = k === typed ? 0 : k.startsWith(typed) ? 1 : (' ' + k).includes(' ' + typed) ? 2 : typed.length >= 6 && k.includes(typed) ? 3 : 4
    // letter for letter the text ("Eiger"): first. "Glöckner" is not that for "Glockner", so there the
    // best known decides, and that is the Großglockner
    return { s, name, how, same: name.trim().toLowerCase() === letter }
  }).filter(p => p.how < 4 && (!belowTowns || p.how === 0 || typed.length >= 5))
    .sort((a, b) => b.same - a.same || (b.s.notability ?? 0) - (a.s.notability ?? 0) || a.how - b.how || (b.s.ele ?? 0) - (a.s.ele ?? 0))
    .slice(0, 4)
  // a lookup that does not answer counts as "a town has that name": the summit is left out
  const taken = await Promise.all(fit.map(p => supabase.rpc('town_lookup', { q: p.name, lim: 1 }).then(r => !!r.error || (r.data ?? []).length > 0, () => true)))
  return fit.filter((_, i) => !taken[i])
}

export const GET = withErrorLog('place-search', async (request) => {
  const sp = new URL(request.url).searchParams
  const q = (sp.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 80) return noStore({ error: 'Search needs 2 to 80 characters.' }, 400)
  if (limiter.limited(clientIp(request))) return noStore({ error: 'Too many requests. Please slow down.' }, 429)
  const lang = pickLang(sp.get('lang'))
  const withSummits = sp.get('summits') === '1' && q.length >= 3
  const [{ data, error }, peaks] = await Promise.all([
    supabase.rpc('towns_search', { q, lim: 20 }),
    // the summits are an extra: when their search does not answer, the towns are offered alone
    withSummits ? supabase.rpc('places_search', { q, near_lat: null, near_lon: null, lim: 30 }).then(r => r.data ?? [], () => []) : [],
  ])
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
  found.sort((a, b) => b.named - a.named || (a.named ? b.weight - a.weight : 0) || a.i - b.i) // the rest keep the database's order
  const fitting = found.filter(f => f.named), alike = found.filter(f => !f.named)
  const summits = peaks.length ? await summitsFor(peaks, q, lang, fitting.length > 0) : []
  const offered = summits.slice(0, fitting.length ? SUMMITS_BELOW : SUMMITS_ALONE)
  const row = (place, name) => {
    const r = townResult(place)
    return { id: r.id, name, admin1: regionIn(r.country_code, r.admin1, lang), country: r.country ?? '', country_code: r.country_code ?? null, latitude: r.latitude, longitude: r.longitude }
  }
  // the towns that fit, the summits below them, then towns that only look alike while there is room
  const results = [
    ...fitting.slice(0, SHOWN - offered.length).map(f => row(f.t, f.name)),
    ...offered.map(p => ({ id: p.s.id, name: p.name, admin1: null, country: '', country_code: null, latitude: p.s.lat, longitude: p.s.lon, elev: p.s.ele, summit: true })),
  ]
  results.push(...alike.slice(0, Math.max(0, SHOWN - results.length)).map(f => row(f.t, f.name)))
  return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
})

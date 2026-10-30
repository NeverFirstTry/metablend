// The Hiking search from our own data (app/api/peaks; unit tested with
// fakes): summits and huts by name, as you type too, and a town the query
// names with what's around it — what "Near you" would show standing there,
// and its nearest huts. A sent search (Enter) for a village too small for our
// towns (under 5 000 people: Grindelwald, Saas-Fee) asks the geocoder where it
// is; typing never goes outside. Cached a day, or 5 minutes when a lookup
// failed — an incomplete answer mustn't stick.
import { haversineKm } from '../geo.js'
import { resolveHeights } from '../hike/heights.js'
import { aroundTown } from '../hike/near.js'
import { mergePeaks, namedLike, pickTown } from '../hike/search.js'

export async function ownSearch(query, feat, { places, featured, demEle, geocode, km = 25 }) {
  const [found, towns] = await Promise.all([places.search(query.q, query.bias), places.towns(query.q)])
  if (!found) return null
  let town = pickTown(towns, query.q), geocodeDown = false
  if (!town && query.full) {
    const g = await geocode(query.q)
    town = g.place
    geocodeDown = g.down
  }
  // a town's name: the summits around it, not the typo guesses for it
  const named = town ? namedLike(found, query.q) : found
  const [pool, huts] = town ? await Promise.all([places.pool(town.lat, town.lon), places.near(town.lat, town.lon, km, 3, ['hut'])]) : [null, null]
  const close = (pool ?? []).filter(p => haversineKm(town.lat, town.lon, p.lat, p.lon) <= km)
  const h = await resolveHeights([...named, ...close, ...(huts ?? [])], { osmEle: async () => ({}), demEle })
  // the first of each: a summit found by name keeps its distance from you
  const byId = new Map()
  for (const p of h.peaks) if (!byId.has(p.id)) byId.set(p.id, p)
  const peaks = mergePeaks(feat, named.map(p => byId.get(p.id)))
  const around = town ? {
    place: { name: town.name, region: town.region ?? null, country: town.country ?? null },
    peaks: aroundTown(close.map(p => byId.get(p.id)), (huts ?? []).map(p => byId.get(p.id)), featured, town, { km })
      .filter(p => !peaks.some(q => q.id === p.id)),
  } : null
  const incomplete = h.demDown || towns === null || geocodeDown || (town && (!pool || !huts))
  return { body: { peaks, around }, age: incomplete ? 300 : 86400 }
}

// Whether our answer stands: always while typing (even empty — typing never
// goes outside); a sent search we have nothing for asks the outside services.
export const ownAnswers = (own, full) => !!own && !(full && !own.body.peaks.length && !own.body.around?.peaks.length)

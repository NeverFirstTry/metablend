// Peak search (pure — unit tested): OpenStreetMap results via Photon and the
// Open-Meteo geocoding fallback → one list, featured peaks first.
import { haversineKm } from '../geo.js'
import { parseEle } from './heights.js'

// Lower-case, ß → ss, accents dropped, punctuation → spaces.
export const normalize = s => String(s).toLowerCase().replaceAll('ß', 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

// Substring match from three letters on; two letters only match the start
// of a word, or "er" would fill every slot with featured peaks.
// With 200 featured peaks a word like "mount" matches dozens: show the best
// few — names that start with the query first — and leave the other result
// slots to OpenStreetMap.
export const FEATURED_MAX = 5

export function matchFeatured(q, featured) {
  const n = normalize(q)
  if (!n) return []
  const hit = n.length < 3
    ? name => normalize(name).split(' ').some(w => w.startsWith(n))
    : name => normalize(name).includes(n)
  const rank = p => ([p.name, ...(p.aka ?? [])].some(name => normalize(name).startsWith(n)) ? 0 : 1)
  return featured
    .filter(p => [p.name, ...(p.aka ?? [])].some(hit))
    .map((p, i) => ({ p, i, r: rank(p) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, FEATURED_MAX)
    .map(x => x.p)
}

const KIND = { peak: 'peak', volcano: 'peak', alpine_hut: 'hut' }

export function parsePhoton(json) {
  if (!Array.isArray(json?.features)) return null
  const finite = v => typeof v === 'number' && Number.isFinite(v)
  return json.features
    .filter(f => f?.properties?.name && finite(f.geometry?.coordinates?.[0]) && finite(f.geometry?.coordinates?.[1]))
    .map(f => {
      const p = f.properties
      const [lon, lat] = f.geometry.coordinates
      return {
        id: `osm-${p.osm_type}${p.osm_id}`, name: p.name, lat, lon, elev: null,
        country: p.countrycode ?? null, region: p.state ?? null, kind: KIND[p.osm_value] ?? 'peak',
      }
    })
}

// OpenStreetMap via Nominatim (jsonv2 with extratags and addressdetails):
// summits, volcanoes and huts in the shape Photon's hits had, plus the height
// and how notable OpenStreetMap marks the summit (Wikipedia 2, Wikidata 1,
// summit cross 1) straight from its tags. Anything else — a city, a
// boundary — is dropped. Null when the answer isn't a list.
const NOMINATIM_KIND = { 'natural:peak': 'peak', 'natural:volcano': 'peak', 'tourism:alpine_hut': 'hut', 'tourism:wilderness_hut': 'hut' }

export function parseNominatim(json) {
  if (!Array.isArray(json)) return null
  const finite = v => Number.isFinite(v)
  return json
    .filter(r => NOMINATIM_KIND[`${r?.category}:${r?.type}`] && r.name && finite(Number(r.lat)) && finite(Number(r.lon)) && typeof r.osm_type === 'string' && r.osm_id != null)
    .map(r => {
      const t = r.extratags ?? {}
      const notability = (t.wikipedia ? 2 : 0) + (t.wikidata ? 1 : 0) + (t['summit:cross'] === 'yes' ? 1 : 0)
      return {
        id: `osm-${r.osm_type[0].toUpperCase()}${r.osm_id}`, name: r.name, lat: Number(r.lat), lon: Number(r.lon), elev: parseEle(t.ele),
        country: r.address?.country_code?.toUpperCase() ?? null, region: r.address?.state ?? null,
        kind: NOMINATIM_KIND[`${r.category}:${r.type}`], ...(notability ? { notability } : {}),
      }
    })
}

// A name as pickTown and namedLike compare it: accents, case and spaces aside ("Hà Nội" and "hanoi" are one name).
const squash = s => normalize(s).replaceAll(' ', '')
export const plainQuery = squash

// How long a search answer may be CDN-cached: a day when every source
// answered, five minutes when one was down — an outage must not stick.
export const searchMaxAge = ({ photonDown, elevationsDown }) => (photonDown || elevationsDown ? 300 : 86400)

// Featured matches first (exact published heights, in the same shape as
// every other hit), then the hits that have a height (see resolveHeights).
// A hit within 1 km of a featured peak is the same summit; a hit without a
// height can't get a summit forecast.
export function mergePeaks(featured, found, limit = 10) {
  const feat = featured.map(f => ({
    id: f.id, name: f.name, lat: f.lat, lon: f.lon, elev: f.elev,
    // a featured peak's region is a list group ("eastern-alps"), not a place
    // name like a search hit's state — the result row shows only the country
    country: f.country ?? null, region: null, kind: f.kind ?? 'peak', grade: f.grade ?? null,
  }))
  const rest = found.filter(p => p.elev != null && !feat.some(f => haversineKm(f.lat, f.lon, p.lat, p.lon) < 1))
  return [...feat, ...rest].slice(0, limit)
}

// "Near me": the search is biased to a rounded position (one cached query
// per ~10 km), the peak list gets the exact one — it shows distances.
export function applyLocation(c, { setBias, onLocate }) {
  setBias({ lat: Math.round(c.lat * 10) / 10, lon: Math.round(c.lon * 10) / 10 })
  onLocate?.({ lat: c.lat, lon: c.lon })
}

// The town a search names (our towns table, lib/places/db.js): one of its
// names exactly, or — while typing — the start of one from five letters on
// ("zerma" → Zermatt; "mont" isn't Montréal yet) — a town called so before
// one only once called so (Lerma, Mexico, was "Zerma de Villada").
export function pickTown(towns, q) {
  if (!Array.isArray(towns)) return null
  const n = plainQuery(q)
  if (n.length < 5) return towns.find(t => t.exact) ?? null
  return towns.find(t => t.exact) ?? towns.find(t => t.prefix && squash(t.name).startsWith(n)) ?? towns.find(t => t.prefix) ?? null
}

// When the query names a town, the summits whose name (in any language)
// holds it — not the typo guesses ("hanoi" isn't Hanover Mountain). A query
// without Latin letters to compare keeps them all.
export function namedLike(rows, q) {
  const n = squash(q)
  if (!n) return rows
  return rows.filter(p => [p.name, ...Object.values(p.names ?? {})].some(name => squash(name).includes(n)))
}

// A summit's name in the reader's language, where OpenStreetMap has one.
export const localName = (p, lang) => p.names?.[lang] ?? p.name

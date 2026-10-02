// Peak search (pure — unit tested): OpenStreetMap results via Photon and the
// Open-Meteo geocoding fallback → one list, featured peaks first.
import { haversineKm } from '../geo.js'

// Lower-case, ß → ss, accents dropped, punctuation → spaces.
export const normalize = s => String(s).toLowerCase().replaceAll('ß', 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

// Substring match from three letters on; two letters only match the start
// of a word, or "er" would fill every slot with featured peaks.
export function matchFeatured(q, featured) {
  const n = normalize(q)
  if (!n) return []
  const hit = n.length < 3
    ? name => normalize(name).split(' ').some(w => w.startsWith(n))
    : name => normalize(name).includes(n)
  return featured.filter(p => [p.name, ...(p.aka ?? [])].some(hit))
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

// GeoNames feature codes for mountains, peaks, volcanoes and hills.
const MOUNTAIN_CODES = new Set(['MT', 'MTS', 'PK', 'PKS', 'VLC', 'HLL'])

export function parseGeocodingPeaks(json) {
  if (!json) return null
  return (json.results ?? [])
    .filter(r => MOUNTAIN_CODES.has(r.feature_code) && typeof r.elevation === 'number')
    .map(r => ({
      id: `gn-${r.id}`, name: r.name, lat: r.latitude, lon: r.longitude, elev: Math.round(r.elevation),
      country: r.country_code ?? null, region: r.admin1 ?? null, kind: 'peak',
    }))
}

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

// Peak search (pure — unit tested): OpenStreetMap results via Photon and the
// Open-Meteo geocoding fallback → one list, featured peaks first.
import { haversineKm } from '../geo.js'

// Lower-case, ß → ss, accents dropped, punctuation → spaces.
export const normalize = s => String(s).toLowerCase().replaceAll('ß', 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

export function matchFeatured(q, featured) {
  const n = normalize(q)
  if (!n) return []
  return featured.filter(p => [p.name, ...(p.aka ?? [])].some(name => normalize(name).includes(n)))
}

const KIND = { peak: 'peak', volcano: 'peak', alpine_hut: 'hut' }

export function parsePhoton(json) {
  if (!Array.isArray(json?.features)) return null
  return json.features
    .filter(f => f?.properties?.name && Array.isArray(f.geometry?.coordinates))
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

// Featured matches first (exact published heights), then the rest with
// heights filled in from `elevations` (aligned with `found`; null = the
// elevation service failed). A hit within 1 km of a featured peak is the same
// summit; a hit still without a height can't get a summit forecast.
export function mergePeaks(featured, found, elevations, limit = 10) {
  const withElev = found.map((p, i) => (p.elev != null ? p
    : { ...p, elev: typeof elevations?.[i] === 'number' ? Math.round(elevations[i]) : null }))
  const rest = withElev.filter(p => p.elev != null && !featured.some(f => haversineKm(f.lat, f.lon, p.lat, p.lon) < 1))
  return [...featured, ...rest].slice(0, limit)
}

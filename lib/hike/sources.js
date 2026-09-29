// Upstream requests for the hiking engine (network; never throw — getJson
// returns null on timeout, non-2xx or bad JSON).
import { getJson } from '../outlook/http.js'
import { OM_MODELS } from '../outlook/models.js'
import { SUMMIT_HOURLY } from './parse.js'

// Every outlook model, downscaled to the summit's height, 8 days.
export function fetchSummitRaw(lat, lon, elev) {
  const models = OM_MODELS.map(m => m.model).join(',')
  return getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&elevation=${elev}&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${models}&forecast_days=8&timezone=auto`, { cache: 'no-store' })
}

const PEAK_TAGS = ['natural:peak', 'natural:volcano', 'tourism:alpine_hut']

// OpenStreetMap peaks, volcanoes and huts (Photon, fair use: results are
// CDN-cached per query for a day by /api/peaks).
export function fetchPhotonRaw(q, { lat, lon } = {}) {
  const tags = PEAK_TAGS.map(t => `&osm_tag=${t}`).join('')
  const bias = lat != null && lon != null ? `&lat=${lat}&lon=${lon}` : ''
  return getJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}${tags}&limit=15${bias}`, { cache: 'no-store', ms: 6000 })
}

// Heights for up to 100 points in one call (Copernicus 90 m DEM), aligned
// with `points`; null when the service fails.
export async function fetchElevations(points) {
  if (!points.length) return []
  const lat = points.map(p => p.lat.toFixed(5)).join(','), lon = points.map(p => p.lon.toFixed(5)).join(',')
  const j = await getJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, { next: { revalidate: 86400 } })
  return Array.isArray(j?.elevation) ? j.elevation : null
}

// GeoNames via Open-Meteo — the fallback when Photon is down.
export function fetchGeocodingRaw(q) {
  return getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=20&language=en`, { cache: 'no-store' })
}

// Upstream requests for the hiking engine (network; never throw — getJson
// returns null on timeout, non-2xx or bad JSON).
import { getJson } from '../outlook/http.js'
import { OM_MODELS } from '../outlook/models.js'
import { SUMMIT_HOURLY } from './parse.js'
import { parseElevations, osmApiUrls, overpassQuery, parseOverpassEle } from './heights.js'

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

// Terrain-model heights for up to 100 points in one call (Copernicus 90 m
// DEM), aligned with `points`; null when the service fails. The fallback
// only — it reads sharp summits low.
export async function fetchElevations(points) {
  if (!points.length) return []
  const lat = points.map(p => p.lat.toFixed(5)).join(','), lon = points.map(p => p.lon.toFixed(5)).join(',')
  return parseElevations(await getJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, { next: { revalidate: 86400 } }), points.length)
}

// Overpass rate-limits per IP (shared on Vercel) and gets overloaded, so it
// is only the backup behind the OpenStreetMap API's plain id lookup.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

// Surveyed OpenStreetMap heights of search hits: { N123: 2076, … } or null.
// One lookup per uncached search query (results are cached a day).
export async function fetchOsmHeights(peaks) {
  const urls = osmApiUrls(peaks)
  if (!urls.length) return {}
  // a deleted element 404s its whole multi-fetch — then Overpass takes over
  const parts = await Promise.all(urls.map(u => getJson(u, { cache: 'no-store', ms: 5000 })))
  if (parts.every(Boolean)) return Object.assign({}, ...parts.map(parseOverpassEle))
  const query = overpassQuery(peaks)
  for (const url of OVERPASS) {
    const json = await getJson(url, {
      method: 'POST', body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store', ms: 5000,
    })
    const heights = parseOverpassEle(json)
    if (heights) return heights
  }
  return null
}

// GeoNames via Open-Meteo — the fallback when Photon is down.
export function fetchGeocodingRaw(q) {
  return getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=20&language=en`, { cache: 'no-store' })
}

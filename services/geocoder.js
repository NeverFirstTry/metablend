// Minimal Nominatim wrapper for server-side use.
// Default contact identifies g-radio; override with GEOCODER_EMAIL in production.
const fetch = require('node-fetch');

const GEOCODER_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org';
const GEOCODER_EMAIL = process.env.GEOCODER_EMAIL || 'g-radio@example.com';
const DEFAULT_HEADERS = {
  'User-Agent': `metablend/1.0 (g-radio)`,
  'From': GEOCODER_EMAIL, // Nominatim respects either User-Agent or From/email; include both if possible
  'Accept-Language': process.env.GEOCODER_ACCEPT_LANGUAGE || 'en',
};

function buildUrl(path, params) {
  const url = new URL(path, GEOCODER_URL);
  Object.keys(params).forEach(k => {
    if (params[k] !== undefined && params[k] !== null) {
      url.searchParams.set(k, String(params[k]));
    }
  });
  return url.toString();
}

/**
 * Forward geocoding (address -> list of results)
 * q: free-text query
 * options: { limit, viewbox, countrycodes, polygon_geojson }
 */
async function search(q, { limit = 5, viewbox, countrycodes, polygon_geojson = 0 } = {}) {
  if (!q) throw new Error('search: q is required');

  const params = {
    q,
    format: 'json',
    addressdetails: 1,
    limit,
    polygon_geojson,
  };
  if (viewbox) params.viewbox = viewbox; // "minLon,minLat,maxLon,maxLat"
  if (countrycodes) params.countrycodes = countrycodes; // "us,ca"
  const url = buildUrl('/search', params);

  const res = await fetch(url, { headers: DEFAULT_HEADERS, timeout: 10000 });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Geocoder search error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Reverse geocoding (lat, lon -> address)
 * options: { zoom }
 */
async function reverse(lat, lon, { zoom = 18 } = {}) {
  if (lat == null || lon == null) throw new Error('reverse: lat and lon are required');

  const params = {
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    addressdetails: 1,
    zoom,
  };
  const url = buildUrl('/reverse', params);

  const res = await fetch(url, { headers: DEFAULT_HEADERS, timeout: 10000 });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Geocoder reverse error ${res.status}: ${text}`);
  }
  return res.json();
}

module.exports = { search, reverse };
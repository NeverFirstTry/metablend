// The outlook's source registry. Ranges and domains measured 2026-09-29 (see
// the spec): the *pure* regional models are used on purpose — their
// *_seamless variants quietly continue as ECMWF-derived copies of each other
// after ~2 days, which would fake agreement. Pure models simply stop.
export const OM_MODELS = [
  { id: 'ecmwf', model: 'ecmwf_ifs025' },
  { id: 'gfs', model: 'gfs_seamless' },
  { id: 'icon', model: 'icon_seamless' },
  { id: 'ukmo', model: 'ukmo_global_deterministic_10km' },
  { id: 'gem', model: 'gem_seamless' },
  { id: 'jma', model: 'jma_seamless' },
  { id: 'meteofrance', model: 'meteofrance_seamless' },
  { id: 'knmi', model: 'knmi_harmonie_arome_europe' },
  { id: 'dmi', model: 'dmi_harmonie_arome_europe' },
  { id: 'metno-nordic', model: 'metno_nordic' },
]

// Coverage of the national services (same boxes as the live fetchers).
export const BOXES = {
  conus: { latMin: 24.5, latMax: 49.5, lonMin: -125, lonMax: -66.5 }, // NWS
  nordic: { latMin: 52.5, latMax: 70.7, lonMin: 2.5, lonMax: 33 }, // SMHI
  germany: { latMin: 47, latMax: 55.2, lonMin: 5.5, lonMax: 15.5 }, // DWD MOSMIX via Bright Sky
}

export const inBox = (b, lat, lon) => lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax

// The fallback when the request for every model fails (Open-Meteo sometimes
// hangs on the big one): three global models, a far lighter request.
export const CORE_MODELS = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless']

// all models first, then the core three; the result says when it fell back
export async function withCoreFallback(url, get, opts) {
  const full = await get(url(OM_MODELS.map(m => m.model)), { cache: 'no-store', ms: 8000, retries: 1, ...opts })
  if (full) return full
  const core = await get(url(CORE_MODELS), { cache: 'no-store', ms: 7000, ...opts })
  return core ? { ...core, fallback: 'core' } : null
}

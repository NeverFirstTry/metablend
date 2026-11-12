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

// Where each regional Open-Meteo model has values, by its model name (the forecast's list in
// lib/weather.js uses the same names). Outside its box a model is not asked: it has nothing to say there
// and is charged all the same (variables × models). Measured 2026-11-12 by asking grids of places
// (2° over Europe, 1° around the Alps, 5° over North America): each box is the outermost places that
// answered plus one grid step on every side, so it errs towards asking. The areas are not rectangles;
// in a box's corners a model can still have nothing. A model without a box is asked everywhere, and a
// request needs one of those: for a place outside every model asked, Open-Meteo answers 400.
export const MODEL_BOXES = {
  knmi_harmonie_arome_europe: { latMin: 38, latMax: 70, lonMin: -42, lonMax: 38 },
  dmi_harmonie_arome_europe: { latMin: 38, latMax: 70, lonMin: -44, lonMax: 40 },
  metno_nordic: { latMin: 52, latMax: 74, lonMin: -12, lonMax: 42 },
  meteoswiss_icon_ch1: { latMin: 42, latMax: 50, lonMin: 0, lonMax: 17 },
  italia_meteo_arpae_icon_2i: { latMin: 32, latMax: 49, lonMin: 2, lonMax: 24 },
  ncep_nbm_conus: { latMin: 15, latMax: 60, lonMin: -140, lonMax: -55 },
}
export const modelCovers = (model, lat, lon) => !MODEL_BOXES[model] || inBox(MODEL_BOXES[model], lat, lon)

// The fallback when the request for every model fails (Open-Meteo sometimes
// hangs on the big one): three global models, a far lighter request.
export const CORE_MODELS = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless']

// all models first, then the core three; the result says when it fell back
// coreOnly: only the three core models are asked (the summit pages' stored copy), which is no fallback
export async function withCoreFallback(url, get, { coreOnly = false, ...opts } = {}) {
  const full = coreOnly ? null : await get(url(OM_MODELS.map(m => m.model)), { cache: 'no-store', ms: 8000, retries: 1, ...opts })
  if (full) return full
  const core = await get(url(CORE_MODELS), { cache: 'no-store', ms: 7000, retries: 1, ...opts })
  return core ? (coreOnly ? core : { ...core, fallback: 'core' }) : null
}

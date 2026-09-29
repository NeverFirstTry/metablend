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

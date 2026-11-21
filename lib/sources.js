// Display names for every source id — the live ("right now") sources and the
// outlook's models alike. One list, so the forecast route, the outlook and the
// leaderboard can't drift apart again.
export const SOURCE_NAMES = {
  'open-meteo': 'Open-Meteo',
  owm: 'OpenWeatherMap',
  weatherapi: 'WeatherAPI',
  'met-norway': 'MET Norway',
  'visual-crossing': 'Visual Crossing',
  geosphere: 'GeoSphere Austria',
  ecmwf: 'ECMWF IFS',
  gfs: 'NOAA GFS',
  icon: 'DWD ICON',
  nws: 'NWS (US)',
  brightsky: 'DWD Bright Sky',
  smhi: 'SMHI (Nordics)',
  metablend: 'MetaBlend Local',
  chmi: 'CHMI ALADIN',
  gem: 'Canada GEM',
  jma: 'JMA (Japan)',
  meteofrance: 'Météo-France',
  cma: 'CMA GRAPES (China)',
  aifs: 'ECMWF AIFS (AI)',
  meteoswiss: 'MeteoSwiss ICON-CH',
  italiameteo: 'ItaliaMeteo ICON-2I',
  nbm: 'NOAA NBM (US)',
  pirateweather: 'Pirate Weather',
  knmi: 'KNMI HARMONIE',
  dmi: 'DMI HARMONIE',
  'metno-nordic': 'MET Nordic',
}

// sources we no longer ask: named on old leaderboard rows, never in the live
// list. 2026-10-29: NASA POWER (its hourly data runs ~7 days behind — nothing
// for "now"), World Weather Online (key over its daily limit, no free plan
// left) and Tomorrow.io (free plan 500 calls a day / 25 an hour: it missed one
// forecast in six at ~300 a day). 2026-11-12: UK Met Office, whose model data is under a share-alike
// licence (CC BY-SA 4.0); the Czech ALADIN model (CHMI, CC BY 4.0) took its place
const RETIRED = {
  ukmo: 'UK Met Office',
  weatherstack: 'Weatherstack',
  tomorrow: 'Tomorrow.io',
  'world-weather-online': 'World Weather Online',
  'nasa-power': 'NASA POWER',
}
export const isRetired = id => id in RETIRED
export const sourceName = id => SOURCE_NAMES[id] ?? RETIRED[id] ?? id

// "N sources" wherever it's shown: those that answered — MetaBlend Local is
// made from them, so it isn't one more (the public "up to 20 at once")
export const countSources = list => list.filter(s => !s.down && !s.synthetic).length

// Regional sources only count, and only show, in the regions they cover; a
// stray row elsewhere (NWS with one Europe report) is data, not a ranking.
const COVERAGE = {
  nws: ['north_america'], nbm: ['north_america'],
  'metno-nordic': ['europe'], smhi: ['europe'], geosphere: ['europe'], brightsky: ['europe'],
  dmi: ['europe'], knmi: ['europe'], meteoswiss: ['europe'], italiameteo: ['europe'], chmi: ['europe'],
}
export const covers = (id, region) => !COVERAGE[id] || COVERAGE[id].includes(region)

// Sources whose terms forbid handing on their raw data and ask for their credit beside every value shown
// (Visual Crossing, docs/source-licences.md): they count in the blend on our server with every value, and
// the public answer carries only what the Sources panel lists of them, the temperature. That panel has the
// credit line right under its list (app/components/outlook/SourcesPanel.jsx); a screen without one shows
// such a source by name only (lib/landing.js).
export const PANEL_ONLY = new Set(['visual-crossing'])
export const publicSources = list => list.map(s => (PANEL_ONLY.has(s.apiId)
  ? { apiId: s.apiId, displayName: s.displayName, responseMs: s.responseMs, ...(s.down ? { down: true } : { temp: s.temp }) }
  : s))

// Order (owner 2026-11-15): MetaBlend Local pinned first, then by the share the reader sees (whole
// percent), highest first; equal shares by name, so the list keeps its order between visits. A source
// that did not answer has no share.
export const sortSources = (sources, weightOf) => {
  const name = s => s.displayName ?? s.apiId
  const shown = s => Math.round(weightOf(s) * 100)
  return [...sources].sort((a, b) => (b.apiId === 'metablend') - (a.apiId === 'metablend') || shown(b) - shown(a) || name(a).localeCompare(name(b), 'en', { sensitivity: 'base' }))
}

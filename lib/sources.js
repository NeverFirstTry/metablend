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
  ukmo: 'UK Met Office',
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
// forecast in six at ~300 a day)
const RETIRED = {
  weatherstack: 'Weatherstack',
  tomorrow: 'Tomorrow.io',
  'world-weather-online': 'World Weather Online',
  'nasa-power': 'NASA POWER',
}
export const sourceName = id => SOURCE_NAMES[id] ?? RETIRED[id] ?? id

// "N sources" wherever it's shown: those that answered — MetaBlend Local is
// made from them, so it isn't one more (the public "up to 20 at once")
export const countSources = list => list.filter(s => !s.down && !s.synthetic).length

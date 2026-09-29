// Display names for every source id — the live ("right now") sources and the
// outlook's models alike. One list, so the forecast route, the outlook and the
// leaderboard can't drift apart again.
export const SOURCE_NAMES = {
  'open-meteo': 'Open-Meteo',
  owm: 'OpenWeatherMap',
  weatherapi: 'WeatherAPI',
  tomorrow: 'Tomorrow.io',
  'met-norway': 'MET Norway',
  'visual-crossing': 'Visual Crossing',
  'world-weather-online': 'World Weather Online',
  weatherstack: 'Weatherstack',
  'nasa-power': 'NASA POWER',
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
  knmi: 'KNMI HARMONIE',
  dmi: 'DMI HARMONIE',
  'metno-nordic': 'MET Nordic',
}

export const sourceName = id => SOURCE_NAMES[id] ?? id

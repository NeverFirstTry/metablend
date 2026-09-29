// Records trimmed real API responses into lib/outlook/__fixtures__/ for the
// outlook parser tests. Re-run when an upstream format changes:
//   node scripts/record-outlook-fixtures.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'outlook', '__fixtures__')
fs.mkdirSync(OUT, { recursive: true })
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }
async function get(url) {
  const r = await fetch(url, { headers: UA })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}
function save(name, data) {
  const s = JSON.stringify(data)
  fs.writeFileSync(path.join(OUT, name), s)
  console.log(name.padEnd(26), `${(s.length / 1024).toFixed(0)} kB`)
}

const MODELS = 'ecmwf_ifs025,gfs_seamless,icon_seamless,ukmo_global_deterministic_10km,gem_seamless,jma_seamless,meteofrance_seamless,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic'
const HOURLY = 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code'
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset'
save('om-multi-vienna.json', await get(`https://api.open-meteo.com/v1/forecast?latitude=48.21&longitude=16.37&hourly=${HOURLY}&daily=${DAILY}&models=${MODELS}&forecast_days=3&timezone=auto`))

const pts = await get('https://api.weather.gov/points/41.8800,-87.6300')
const nws = await get(pts.properties.forecastHourly)
save('nws-chicago.json', { properties: { periods: nws.properties.periods.slice(0, 72) } })

const smhi = await get('https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.0700/lat/59.3300/data.json')
save('smhi-stockholm.json', { timeSeries: smhi.timeSeries.slice(0, 80) })

const today = new Date().toISOString().slice(0, 10)
const last = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10)
const bs = await get(`https://api.brightsky.dev/weather?lat=52.52&lon=13.40&date=${today}&last_date=${last}`)
save('brightsky-berlin.json', { weather: bs.weather.slice(0, 96), sources: bs.sources })

const met = await get('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=59.9100&lon=10.7500')
save('metno-oslo.json', { properties: { timeseries: met.properties.timeseries.slice(0, 90) } })

// Pure parser for the summit request: the outlook's models, downscaled to the
// peak's height, with the variables a summit forecast needs. One series per
// model:
//   { id, hourly: [{ t, temp, feels, pop, precip, code, cape, fl, lpi, cloud,
//                    wind10, w850, w700, w600, w500, w300 }] }
// A variable a model doesn't publish is null — that model just doesn't vote
// on it.
import { OM_MODELS } from '../outlook/models.js'
import { num } from '../outlook/parse.js'

export const SUMMIT_HOURLY = [
  'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
  'weather_code', 'cape', 'freezing_level_height', 'lightning_potential', 'cloud_cover',
  'wind_speed_10m', 'wind_speed_850hPa', 'wind_speed_700hPa', 'wind_speed_600hPa',
  'wind_speed_500hPa', 'wind_speed_300hPa',
]

const FIELDS = {
  temp: 'temperature_2m', feels: 'apparent_temperature', pop: 'precipitation_probability',
  precip: 'precipitation', code: 'weather_code', cape: 'cape', fl: 'freezing_level_height',
  lpi: 'lightning_potential', cloud: 'cloud_cover', wind10: 'wind_speed_10m',
  w850: 'wind_speed_850hPa', w700: 'wind_speed_700hPa', w600: 'wind_speed_600hPa',
  w500: 'wind_speed_500hPa', w300: 'wind_speed_300hPa',
}

export function parseSummitMulti(json, models = OM_MODELS) {
  const h = json?.hourly
  if (!Array.isArray(h?.time)) return null
  const series = []
  for (const { id, model } of models) {
    const col = name => h[`${name}_${model}`]
    if (!Array.isArray(col('temperature_2m'))) continue
    const hourly = []
    h.time.forEach((t, i) => {
      const p = { t }
      for (const [key, name] of Object.entries(FIELDS)) p[key] = num(col(name)?.[i])
      if (p.temp != null) hourly.push(p)
    })
    if (hourly.length) series.push({ id, hourly })
  }
  const d = json.daily ?? {}
  // sunrise/sunset come back unsuffixed or once per model, depending on version
  const sunCol = k => d[k] ?? Object.entries(d).find(([key]) => key.startsWith(`${k}_`))?.[1]
  const hm = v => (typeof v === 'string' ? v.slice(11, 16) : null)
  const rises = sunCol('sunrise') ?? [], sets = sunCol('sunset') ?? []
  // each day's own sun times: they shift by an hour across a DST change
  const sunByDate = {}
  rises.forEach((r, i) => { if (typeof r === 'string') sunByDate[r.slice(0, 10)] = { sunrise: hm(r), sunset: hm(sets[i]) } })
  return {
    utcOffsetSec: num(json.utc_offset_seconds) ?? 0,
    elevation: num(json.elevation),
    series,
    sun: { sunrise: hm(rises[0]), sunset: hm(sets[0]) },
    sunByDate,
  }
}

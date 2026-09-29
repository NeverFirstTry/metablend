// Pure parsers for the outlook's Open-Meteo multi-model response, plus the
// hourly → daily aggregation the national services need. Every series has
// the same shape:
//   { id, hourly: [{ t, temp, pop, precip, wind, code }],
//         daily:  [{ date, max, min, pop, precip, wind, code }] }
// t is the CITY-local hour 'YYYY-MM-DDTHH:MM', date the city-local day.

import { OM_MODELS } from './models.js'

export const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const r1 = v => Math.round(v * 10) / 10

// Daily values from hourly points — only for days with enough of them: a day
// seen for 6 hours at the edge of a range must not report its "maximum".
export function dailyFromHourly(hourly, minSamples = 20) {
  const byDate = new Map()
  for (const p of hourly) {
    const date = p.t.slice(0, 10)
    let e = byDate.get(date)
    if (!e) byDate.set(date, (e = { date, temps: [], pops: [], precip: 0, precipN: 0, winds: [] }))
    e.temps.push(p.temp)
    if (p.pop != null) e.pops.push(p.pop)
    if (p.precip != null) { e.precip += p.precip; e.precipN++ }
    if (p.wind != null) e.winds.push(p.wind)
  }
  return [...byDate.values()]
    .filter(e => e.temps.length >= minSamples)
    .map(e => ({
      date: e.date,
      max: Math.max(...e.temps),
      min: Math.min(...e.temps),
      pop: e.pops.length ? Math.max(...e.pops) : null,
      precip: e.precipN ? r1(e.precip) : null,
      wind: e.winds.length ? Math.max(...e.winds) : null,
      code: null,
    }))
}

export function parseOpenMeteoMulti(json, models = OM_MODELS) {
  const h = json?.hourly, d = json?.daily
  if (!Array.isArray(h?.time) || !Array.isArray(d?.time)) return null
  const series = []
  for (const { id, model } of models) {
    const hv = name => h[`${name}_${model}`]
    const dv = name => d[`${name}_${model}`]
    const temps = hv('temperature_2m')
    if (!Array.isArray(temps)) continue
    const hourly = []
    h.time.forEach((t, i) => {
      const temp = num(temps[i])
      if (temp == null) return
      hourly.push({
        t, temp,
        pop: num(hv('precipitation_probability')?.[i]),
        precip: num(hv('precipitation')?.[i]),
        wind: num(hv('wind_speed_10m')?.[i]),
        code: num(hv('weather_code')?.[i]),
      })
    })
    // the API's daily block also fills edge days from a few hours — only
    // trust it where the model covered (nearly) the whole local day
    const covered = new Map()
    for (const p of hourly) covered.set(p.t.slice(0, 10), (covered.get(p.t.slice(0, 10)) ?? 0) + 1)
    const daily = []
    d.time.forEach((date, i) => {
      const max = num(dv('temperature_2m_max')?.[i]), min = num(dv('temperature_2m_min')?.[i])
      if (max == null || min == null || (covered.get(date) ?? 0) < 20) return
      daily.push({
        date, max, min,
        pop: num(dv('precipitation_probability_max')?.[i]),
        precip: num(dv('precipitation_sum')?.[i]),
        wind: num(dv('wind_speed_10m_max')?.[i]),
        code: num(dv('weather_code')?.[i]),
      })
    })
    if (hourly.length) series.push({ id, hourly, daily })
  }
  // sunrise/sunset come back unsuffixed or once per model, depending on version
  const sunCol = k => d[k] ?? Object.entries(d).find(([key]) => key.startsWith(`${k}_`))?.[1]
  const hm = v => (typeof v === 'string' ? v.slice(11, 16) : null)
  return {
    utcOffsetSec: num(json.utc_offset_seconds) ?? 0,
    series,
    sun: { sunrise: hm(sunCol('sunrise')?.[0]), sunset: hm(sunCol('sunset')?.[0]) },
  }
}

// Assembles the /api/outlook payload from raw upstream responses. Pure: the
// route does the fetching, this does everything else — so it's unit tested.

import { parseOpenMeteoMulti } from './parse.js'
import { parseNational, parseMetNorway } from './national.js'
import { blendHourly, blendDaily } from './blend.js'
import { indexArchive, normalsFor, rainyDaysNormal, anomalies } from './climate.js'
import { todayHours, headlineToday, headlineTomorrow, headline7, bestTimeOutside } from './headlines.js'
import { addDays, localHourIso } from '../localtime.js'
import { sourceName } from '../sources.js'

export function buildOutlook({ geo, region, multi, climate = null, national = {}, met = null, weights = {}, now = Date.now() }) {
  const parsed = parseOpenMeteoMulti(multi)
  const notes = []
  // Open-Meteo reports the city's real offset; the solar estimate only
  // covers the case where it didn't answer at all
  const utcOffsetSec = parsed?.utcOffsetSec ?? Math.round(geo.lon / 15) * 3600
  const series = [...(parsed?.series ?? []), ...parseNational(national ?? {}, utcOffsetSec)]
  if (!parsed?.series.length) {
    const fallback = met ? parseMetNorway(met, utcOffsetSec) : null
    if (fallback) series.push(fallback)
    notes.push('fewer_sources')
  }

  const nowLocal = localHourIso(utcOffsetSec, now)
  const todayLocal = nowLocal.slice(0, 10)
  const hourly = blendHourly(series, weights, { nowLocal, hours: 168 })
  const days = blendDaily(series, weights, { todayLocal, days: 7 })

  const rows = indexArchive(climate)
  const dates = days.map(d => d.date)
  const normals = rows ? normalsFor(rows, dates) : []
  const tomorrow = addDays(todayLocal, 1)
  // today's sun times stand in for tomorrow's too (they move by minutes)
  const sun = parsed?.sun ?? { sunrise: null, sunset: null }

  const payload = {
    city: geo.name, country: geo.country ?? null, cc: geo.cc ?? null, lat: geo.lat, lon: geo.lon, region,
    generatedAt: new Date(now).toISOString(), utcOffsetSec, nowLocal,
    sources: series.map(s => ({ id: s.id, name: sourceName(s.id), reachHours: s.hourly.length })),
    notes,
    sun,
    hourly,
    bestTime: {
      today: bestTimeOutside(todayHours(hourly, todayLocal).hours, sun),
      tomorrow: bestTimeOutside(hourly.filter(h => h.t.startsWith(tomorrow)), sun),
    },
    days,
    normals,
    vsNormal: anomalies(days, normals),
    rainyDays: {
      forecast: days.filter(d => d.rainPct != null && d.rainPct >= 50).length,
      of: days.length,
      normal: rows ? rainyDaysNormal(rows, dates) : null,
    },
    headlines: {
      today: headlineToday(hourly, { todayLocal }),
      tomorrow: headlineTomorrow(hourly, days, normals, { todayLocal }),
      d7: headline7(days),
    },
  }
  return { payload, series, utcOffsetSec, todayLocal }
}

// Assembles the /api/outlook payload from raw upstream responses. Pure: the
// route does the fetching, this does everything else — so it's unit tested.

import { parseOpenMeteoMulti } from './parse.js'
import { parseNational, parseMetNorway } from './national.js'
import { blendHourly, blendDaily } from './blend.js'
import { parseEnsemble, applyEnsemble } from './ensemble.js'
import { indexArchive, normalsFor, rainyDaysNormal, monthRecords, anomalies } from './climate.js'
import { headline48, headline7, headline14, bestTimeOutside } from './headlines.js'
import { localHourIso } from '../localtime.js'
import { sourceName } from '../sources.js'

export function buildOutlook({ geo, region, multi, ensemble = null, climate = null, national = {}, met = null, weights = {}, now = Date.now() }) {
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
  let days = blendDaily(series, weights, { todayLocal, days: 14 })
  const ens = parseEnsemble(ensemble)
  if (ens) days = applyEnsemble(days, ens)
  else if (days.some(d => d.lead >= 8)) notes.push('ensemble_unavailable')

  const rows = indexArchive(climate)
  const dates = days.map(d => d.date)
  const normals = rows ? normalsFor(rows, dates) : []

  const payload = {
    city: geo.name, country: geo.country ?? null, lat: geo.lat, lon: geo.lon, region,
    generatedAt: new Date(now).toISOString(), utcOffsetSec, nowLocal,
    sources: series.map(s => ({ id: s.id, name: sourceName(s.id), reachHours: s.hourly.length })),
    notes,
    sun: parsed?.sun ?? { sunrise: null, sunset: null },
    hourly,
    bestTime: bestTimeOutside(hourly),
    days,
    normals,
    vsNormal: anomalies(days, normals),
    rainyDays: {
      forecast: days.filter(d => d.rainPct != null && d.rainPct >= 50).length,
      of: days.length,
      normal: rows ? rainyDaysNormal(rows, dates) : null,
    },
    records: rows ? monthRecords(rows, Number(todayLocal.slice(5, 7))) : null,
    headlines: { h48: headline48(hourly, { todayLocal }), d7: headline7(days), d14: headline14(days, normals) },
  }
  return { payload, series, utcOffsetSec, todayLocal }
}

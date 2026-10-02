// Weather along a route (network through injected getJson / getElevations —
// unit tested with a recorded multi-point response): fill elevations, time
// the walk, one Open-Meteo request for the stage points (the three core
// models, each point at its own height), the summit engine's blend per point,
// then the suggested start and the stages.
import { parseSummitMulti, SUMMIT_HOURLY } from '../hike/parse.js'
import { blendSummitHourly } from '../hike/blend.js'
import { OM_MODELS, CORE_MODELS } from '../outlook/models.js'
import { addDays, localHourIso } from '../localtime.js'
import { cumulative, climb, withReturn, highestIndex } from './geometry.js'
import { etas } from './timing.js'
import { pickSamples } from './samples.js'
import { suggestStart, stagesAt, toMin, hhmm } from './verdict.js'

const CORE = OM_MODELS.filter(m => CORE_MODELS.includes(m.model))

export function forecastUrl(points) {
  const list = k => points.map(p => p[k].toFixed(4)).join(',')
  return `https://api.open-meteo.com/v1/forecast?latitude=${list('lat')}&longitude=${list('lon')}&elevation=${points.map(p => Math.round(p.ele ?? 0)).join(',')}`
    + `&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${CORE_MODELS.join(',')}&forecast_days=8&timezone=auto`
}

export async function routeWeather({ points, date, pace = 'normal', start = null, roundTrip = false, now = Date.now() }, { getJson, getElevations, weights = {} }) {
  let pts = points.map(p => ({ ...p }))
  const missing = pts.flatMap((p, i) => (p.ele == null ? [i] : []))
  for (let k = 0; k < missing.length; k += 100) {
    const chunk = missing.slice(k, k + 100)
    const e = await getElevations(chunk.map(i => pts[i]))
    if (e) chunk.forEach((i, j) => { pts[i].ele = e[j] })
  }
  if (roundTrip) pts = withReturn(pts)

  const dist = cumulative(pts), offsetsAll = etas(pts, pace)
  const idx = pickSamples(pts)
  const samples = idx.map(i => ({ i, km: Math.round(dist[i] / 100) / 10, ele: pts[i].ele == null ? null : Math.round(pts[i].ele), offset: Math.round(offsetsAll[i]) }))
  const raw = await getJson(forecastUrl(idx.map(i => pts[i])), { cache: 'no-store', ms: 15000, retries: 1 })
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (list.length !== idx.length) return null
  const parsed = list.map(j => parseSummitMulti(j, CORE))
  if (parsed.some(p => !p?.series?.length)) return null

  const utcOffsetSec = parsed[0].utcOffsetSec
  const todayLocal = localHourIso(utcOffsetSec, now).slice(0, 10)
  const nowMin = toMin(new Date(now + utcOffsetSec * 1000).toISOString().slice(11, 16))
  const hoursByStage = parsed.map((p, k) => blendSummitHourly(p.series, weights, { nowLocal: `${todayLocal}T00:00`, elev: samples[k].ele ?? 0, hours: 24 * 8 }))
  const sunOf = d => parsed[0].sunByDate?.[d] ?? parsed[0].sun
  const offsets = samples.map(s => s.offset)
  const suggestFor = d => suggestStart({ hoursByStage, offsets, date: d, sun: sunOf(d), notBefore: d === todayLocal ? nowMin : 0 })

  const suggestion = suggestFor(date)
  if (suggestion.none) {
    const last = hoursByStage[0].at(-1)?.t.slice(0, 10) ?? date
    for (let d = addDays(date, 1); d <= last; d = addDays(d, 1)) {
      const s = suggestFor(d)
      if (!s.none) { suggestion.nextDay = { date: d, start: s.start }; break }
    }
  }
  const hi = highestIndex(idx.map(i => pts[i]))
  const total = offsetsAll.at(-1)
  // no suggestion: the stages from the first possible start (today: not before now)
  const firstStart = Math.ceil(Math.max(toMin(sunOf(date)?.sunrise) ?? 360, date === todayLocal ? nowMin : 0) / 15) * 15
  const startMin = start != null ? toMin(start) : suggestion.startMinute ?? firstStart
  const stages = stagesAt({ hoursByStage, offsets, date, start: startMin }).map((s, k) => ({
    i: samples[k].i, km: samples[k].km, ele: samples[k].ele, eta: s.eta, high: k === hi,
    temp: s.hour?.temp ?? null, feels: s.hour?.feels ?? null, wind: s.hour?.windKmh ?? null, rain: s.hour?.rainPct ?? null,
    storm: s.hour?.storm ?? null, icon: s.hour?.icon ?? null, blocker: s.blocker,
  }))
  return {
    stats: { distanceKm: Math.round(dist.at(-1) / 100) / 10, ...climb(pts), minutes: Math.round(total), longerThanDay: total > 12 * 60 },
    samples: samples.map(({ offset, ...s }) => s),
    suggestion: suggestion.none
      ? { none: true, reason: suggestion.reason, firstBad: suggestion.firstBad, nextDay: suggestion.nextDay ?? null }
      : { start: suggestion.start, latest: suggestion.latest, highAt: hhmm(suggestion.startMinute + samples[hi].offset), finish: hhmm(suggestion.startMinute + total) },
    start: hhmm(startMin),
    stages, date, todayLocal, utcOffsetSec, sun: sunOf(date),
    points: pts.map(p => [p.lat, p.lon, p.ele == null ? null : Math.round(p.ele)]),
  }
}

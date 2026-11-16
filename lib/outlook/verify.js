// Matching saved outlook predictions against airport observations (pure —
// unit tested). Ground truth is NOAA AWC METAR history, which serves ~75 h
// per station (measured), so one daily job can check everything that came
// due since the last run.

import { deltaFromDiff } from '../scoring.js'
import { haversineKm } from '../geo.js'

export const METAR_WINDOW_H = 70
export const GRACE_MS = 2 * 3600e3 // reports can take a while to show up
const SCHEME = { h48: 'lead_h48', d7: 'lead_d7' }

// Precipitation AT the station: vicinity (VC…), blowing/drifting snow and
// obscurations don't count; thunder without precipitation doesn't either.
const PRECIP = /RA|DZ|SN|SG|PL|GR|GS|UP/
export function isWet(wx) {
  if (typeof wx !== 'string') return false
  return wx.split(/\s+/).some(tok => {
    const t = tok.replace(/^[+-]/, '')
    return t && !t.startsWith('VC') && !t.startsWith('BL') && !t.startsWith('DR') && PRECIP.test(t)
  })
}

// Up to `limit` large/medium airports within maxKm (small fields rarely
// report METAR), nearest first. `airports` is lib/airports.json's shape.
export function nearestStations(lat, lon, airports, { maxKm = 60, limit = 3 } = {}) {
  const found = []
  for (const [icao, a] of Object.entries(airports)) {
    if (a.t !== 'l' && a.t !== 'm') continue
    if (Math.abs(a.la - lat) > 1 || Math.abs(a.lo - lon) > 1.5) continue // cheap prefilter
    const km = haversineKm(lat, lon, a.la, a.lo)
    if (km <= maxKm) found.push({ icao, km })
  }
  return found.sort((x, y) => x.km - y.km).slice(0, limit).map(f => f.icao)
}

export function indexMetars(reports) {
  const by = new Map()
  for (const m of reports ?? []) {
    if (typeof m?.temp !== 'number' || !m.icaoId) continue
    const tMs = typeof m.obsTime === 'number' ? m.obsTime * 1000 : Date.parse(m.reportTime)
    if (!Number.isFinite(tMs)) continue
    let a = by.get(m.icaoId)
    if (!a) by.set(m.icaoId, (a = []))
    a.push({ tMs, temp: m.temp, wet: isWet(m.wxString) })
  }
  for (const a of by.values()) a.sort((x, y) => x.tMs - y.tMs)
  return by
}

// The first candidate station that actually reported anything.
export function pickObs(index, stations) {
  for (const s of stations ?? []) {
    const o = index.get(s)
    if (o?.length) return o
  }
  return null
}

export function observationAt(obs, targetMs, tolMs = 30 * 60e3) {
  let best = null
  for (const o of obs ?? []) {
    const d = Math.abs(o.tMs - targetMs)
    if (d <= tolMs && (!best || d < Math.abs(best.tMs - targetMs))) best = o
  }
  return best ? { temp: best.temp, wet: best.wet } : null
}

export function observedDay(obs, startMs, minReports = 18) {
  const inDay = (obs ?? []).filter(o => o.tMs >= startMs && o.tMs < startMs + 864e5)
  if (inDay.length < minReports) return null
  const temps = inDay.map(o => o.temp)
  return { max: Math.max(...temps), min: Math.min(...temps), wet: inDay.some(o => o.wet), n: inDay.length }
}

export const brier = (p, wet) => (p - (wet ? 1 : 0)) ** 2

export function scoreHourly(cp, ob, horizon = 'h48') {
  if (!ob || typeof cp?.temp !== 'number') return null
  const out = [deltaFromDiff(Math.abs(cp.temp - ob.temp), SCHEME[horizon])]
  if (typeof cp.rain === 'number') out.push(deltaFromDiff(brier(cp.rain, ob.wet), 'rain'))
  return out
}

export function scoreDaily(cp, day, horizon) {
  if (!day || typeof cp?.max !== 'number' || typeof cp?.min !== 'number') return null
  const s = SCHEME[horizon]
  const out = [deltaFromDiff(Math.abs(cp.max - day.max), s), deltaFromDiff(Math.abs(cp.min - day.min), s)]
  if (typeof cp.rain === 'number') out.push(deltaFromDiff(brier(cp.rain, day.wet), 'rain'))
  return out
}

// One check against the nearest airport that has what it needs: 18 reports in the day for a day's check,
// one report near the time for an hour's. Taking the first airport that reported anything left the day
// checks of Rome, Tokyo and Johannesburg unscored: the nearest field there reports only by day (1 to 12
// reports), the next one all night (2026-11-16).
export function scoreCheck(kind, item, index, stations, horizon) {
  for (const s of stations ?? []) {
    const obs = index.get(s)
    const ds = kind === 'h' ? scoreHourly(item.cp, observationAt(obs, item.targetMs), horizon) : scoreDaily(item.cp, observedDay(obs, item.startMs), horizon)
    if (ds) return ds
  }
  return null
}

// When a checkpoint can be checked (dueMs) and where its truth starts (dataMs).
export function checkpointTimes(kind, cp, utcOffsetSec) {
  if (kind === 'h') {
    const targetMs = Date.parse(cp.t)
    return { dueMs: targetMs + GRACE_MS, dataMs: targetMs, targetMs }
  }
  const startMs = Date.parse(`${cp.date}T00:00:00Z`) - utcOffsetSec * 1000
  return { dueMs: startMs + 864e5 + GRACE_MS, dataMs: startMs, startMs }
}

export function dueItems(row, nowMs) {
  const done = row.verified ?? {}
  const out = []
  for (const cp of row.checkpoints ?? []) {
    if (done[cp.key]) continue
    const times = checkpointTimes(row.kind, cp, row.utc_offset_sec ?? 0)
    if (times.dueMs > nowMs) continue
    out.push({ cp, ...times, stale: nowMs - times.dataMs > METAR_WINDOW_H * 3600e3 })
  }
  return out
}

export function nextDueAt(row, verified = row.verified ?? {}) {
  let min = null
  for (const cp of row.checkpoints ?? []) {
    if (verified[cp.key]) continue
    const { dueMs } = checkpointTimes(row.kind, cp, row.utc_offset_sec ?? 0)
    if (min == null || dueMs < min) min = dueMs
  }
  return min == null ? null : new Date(min).toISOString()
}

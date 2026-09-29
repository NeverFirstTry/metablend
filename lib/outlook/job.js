// Daily verification of the outlook's saved predictions against METAR
// history — run from the nightly /api/cleanup cron. Checkpoints are marked
// done BEFORE their deltas are applied: a crash loses a signal instead of
// counting it twice (same policy as station calibration).

import airports from '../airports.json'
import { supabase } from '../supabase.js'
import { horizonForLeadDays } from './blend.js'
import { applyOutlookDeltas } from './weights.js'
import {
  METAR_WINDOW_H, nearestStations, indexMetars, pickObs, observationAt, observedDay,
  scoreHourly, scoreDaily, dueItems, nextDueAt,
} from './verify.js'

const AWC = 'https://aviationweather.gov/api/data/metar'
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }
const PAGE = 1000

async function fetchMetarHistory(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40)
    try {
      const res = await fetch(`${AWC}?ids=${chunk.join(',')}&format=json&hours=${METAR_WINDOW_H + 2}`, {
        headers: UA, signal: AbortSignal.timeout(20000), cache: 'no-store',
      })
      if (res.ok) {
        const arr = await res.json()
        if (Array.isArray(arr)) out.push(...arr)
      }
    } catch { /* a failed chunk just leaves those cities waiting for the next run */ }
  }
  return out
}

async function loadDue(nowIso) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('outlook_snapshots')
      .select('id, city, lat, lon, region, source, kind, utc_offset_sec, checkpoints, verified')
      .lte('next_due_at', nowIso)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

export async function runOutlookVerification({ now = Date.now() } = {}) {
  const rows = await loadDue(new Date(now).toISOString())
  const stats = { snapshots: rows.length, scored: 0, expired: 0, waiting: 0, stations: 0, updated: 0, deleted: 0, weights: {} }

  if (rows.length) {
    const stationsByCity = new Map()
    for (const r of rows) {
      if (!stationsByCity.has(r.city) && r.lat != null && r.lon != null) stationsByCity.set(r.city, nearestStations(r.lat, r.lon, airports))
    }
    const ids = [...new Set([...stationsByCity.values()].flat())]
    stats.stations = ids.length
    const index = indexMetars(await fetchMetarHistory(ids))

    const deltas = {} // `${region}|${horizon}` → { source: [delta, …] }
    const add = (region, horizon, source, ds) => {
      for (const reg of region === 'global' ? ['global'] : [region, 'global']) {
        ((deltas[`${reg}|${horizon}`] ??= {})[source] ??= []).push(...ds)
      }
    }
    const marks = [], done = []

    for (const r of rows) {
      const stations = stationsByCity.get(r.city) ?? []
      const obs = pickObs(index, stations)
      const verified = { ...(r.verified ?? {}) }
      for (const item of dueItems(r, now)) {
        const horizon = r.kind === 'h' ? 'h48' : horizonForLeadDays(item.cp.lead)
        const ds = !obs ? null
          : r.kind === 'h' ? scoreHourly(item.cp, observationAt(obs, item.targetMs), horizon)
            : scoreDaily(item.cp, observedDay(obs, item.startMs), horizon)
        if (ds) { verified[item.cp.key] = 'scored'; stats.scored++; add(r.region, horizon, r.source, ds) }
        else if (item.stale || !stations.length) { verified[item.cp.key] = 'expired'; stats.expired++ }
        else stats.waiting++
      }
      const next = nextDueAt(r, verified)
      if (next == null) done.push(r.id)
      else if (JSON.stringify(verified) !== JSON.stringify(r.verified ?? {})) marks.push({ id: r.id, verified, next_due_at: next })
    }

    // 1) persist the marks and drop finished snapshots — before any weight moves
    for (let i = 0; i < marks.length; i += 500) {
      const { error } = await supabase.rpc('mark_outlook_verified', { rows: marks.slice(i, i + 500) })
      if (error) throw error
    }
    stats.updated = marks.length
    for (let i = 0; i < done.length; i += 500) {
      const { error } = await supabase.from('outlook_snapshots').delete().in('id', done.slice(i, i + 500))
      if (error) throw error
    }
    stats.deleted = done.length

    // 2) apply the collected deltas per region × range
    for (const [key, deltaMap] of Object.entries(deltas)) {
      const [region, horizon] = key.split('|')
      stats.weights[key] = await applyOutlookDeltas(region, horizon, deltaMap)
    }
  }

  // 3) safety net: nothing older than 16 days survives, checked or not
  await supabase.from('outlook_snapshots').delete().lt('issued_at', new Date(now - 16 * 864e5).toISOString())
  return stats
}

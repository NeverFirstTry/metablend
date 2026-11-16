// Daily verification of the outlook's saved predictions against METAR
// history — run from the nightly /api/cleanup cron. Checkpoints are marked
// done BEFORE their deltas are applied: a crash loses a signal instead of
// counting it twice (same policy as station calibration).

import airports from '../airports.json'
import { supabase } from '../supabase.js'
import { horizonForLeadDays } from './blend.js'
import { DAILY_LEADS } from './checkpoints.js'
import { applyOutlookDeltas } from './weights.js'
import { readAll } from '../push/paging.js'
import {
  METAR_WINDOW_H, nearestStations, indexMetars, pickObs, observationAt, observedDay,
  scoreHourly, scoreDaily, dueItems, nextDueAt,
} from './verify.js'

const AWC = 'https://aviationweather.gov/api/data/metar'
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// The service answers at most 400 reports a request. With forty stations in one request the 72 hours
// were cut off after the first few stations, most predictions found no measurement and ran out unscored
// (two thirds of them, 2026-11-12). Two stations fit: half-hourly reports for 72 hours are 288.
export const METAR_PER_REQUEST = 2
const METAR_MAX = 400
// The service's page (aviationweather.gov/data/api): "All requests are rate limited to 100 requests per
// minute", "Exceeding request limits will result in access being blocked", at most 400 entries a request.
// Two requests at a time, and a new pair no sooner than 2.4 s after the last one started: at most 50
// requests a minute, half the limit (owner, 2026-11-15). One at a time with a pause asked about half of a
// night's airports in the budget (124 of 254 on 2026-11-15); what was left ran out unscored after 70 hours.
const AT_ONCE = 2
const ROUND_MS = 2400
const BUDGET_MS = 180_000 // the nightly job has 300 s in all: after this the rest waits for the next night

// truncated: requests whose answer was full to the limit, so reports may be missing.
// left: stations not asked because the time budget ran out.
export async function fetchMetarHistory(ids, { get = fetch, pause = ms => new Promise(r => setTimeout(r, ms)), clock = Date.now, budgetMs = BUDGET_MS } = {}) {
  const metars = [], started = clock(), step = METAR_PER_REQUEST * AT_ONCE
  let requests = 0, truncated = 0, left = 0, last = started
  for (let i = 0; i < ids.length && !left; i += step) {
    if (i) { const wait = ROUND_MS - (clock() - last); if (wait > 0) await pause(wait) }
    if (clock() - started > budgetMs) { left = ids.length - i; break }
    last = clock()
    const chunks = []
    for (let j = i; j < Math.min(i + step, ids.length); j += METAR_PER_REQUEST) chunks.push(ids.slice(j, j + METAR_PER_REQUEST))
    requests += chunks.length
    const answers = await Promise.all(chunks.map(async chunk => {
      try {
        const res = await get(`${AWC}?ids=${chunk.join(',')}&format=json&hours=${METAR_WINDOW_H + 2}`, {
          headers: UA, signal: AbortSignal.timeout(20000), cache: 'no-store',
        })
        if (res.status === 429) return 429
        if (res.ok) { const arr = await res.json(); if (Array.isArray(arr)) return arr }
      } catch { /* a failed request just leaves those cities waiting for the next run */ }
      return null
    }))
    for (const arr of answers) if (Array.isArray(arr)) { metars.push(...arr); if (arr.length >= METAR_MAX) truncated++ }
    // told to slow down: nothing more is asked tonight, the refused stations and the rest wait
    const refused = answers.indexOf(429)
    if (refused >= 0) left = ids.length - (i + refused * METAR_PER_REQUEST)
  }
  return { metars, requests, truncated, left }
}

// The stations to ask, the most pressing place first: the one whose oldest check that can still be scored
// is nearest to running out. In row order the budget left the same places unasked night after night, and
// half of their checks ran out unscored (the last two fifths of 179 places, 2026-11-16); this way what is
// left can wait a night. A place with nothing left to score goes last.
export function stationOrder(rows, now, stationsByCity) {
  const oldest = new Map()
  for (const r of rows) for (const item of dueItems(r, now)) if (!item.stale && !(oldest.get(r.city) <= item.dataMs)) oldest.set(r.city, item.dataMs)
  const at = city => oldest.get(city) ?? Infinity
  const cities = [...stationsByCity.keys()].sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0))
  return [...new Set(cities.flatMap(city => stationsByCity.get(city)))]
}

const loadDue = nowIso => readAll((from, to) => supabase
  .from('outlook_snapshots')
  .select('id, city, lat, lon, region, source, kind, utc_offset_sec, checkpoints, verified')
  .lte('next_due_at', nowIso)
  .order('id')
  .range(from, to))

export async function runOutlookVerification({ now = Date.now() } = {}) {
  const rows = await loadDue(new Date(now).toISOString())
  const stats = { snapshots: rows.length, scored: 0, expired: 0, waiting: 0, stations: 0, requests: 0, truncated: 0, stationsLeft: 0, updated: 0, deleted: 0, weights: {} }

  if (rows.length) {
    const stationsByCity = new Map()
    for (const r of rows) {
      if (!stationsByCity.has(r.city) && r.lat != null && r.lon != null) stationsByCity.set(r.city, nearestStations(r.lat, r.lon, airports))
    }
    const ids = stationOrder(rows, now, stationsByCity)
    stats.stations = ids.length
    const history = await fetchMetarHistory(ids)
    stats.requests = history.requests
    stats.truncated = history.truncated
    stats.stationsLeft = history.left
    const index = indexMetars(history.metars)

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
        // days 8–14 from before the outlook stopped at a week: no range to score them in
        if (r.kind === 'd' && item.cp.lead > DAILY_LEADS) { verified[item.cp.key] = 'expired'; stats.expired++; continue }
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

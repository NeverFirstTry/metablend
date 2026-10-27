// One-off backfill (2026-10-27, safe to re-run): every stored route gets its
// heights and is timed again under the current rules — instead of waiting for
// each route to be opened.
//   node scripts/backfill-route-heights.mjs          (writes; DRY=1 to only count)
// - route_cache: missing heights filled from the terrain model, then every
//   route's ascent / descent / walking time recomputed (gaps interpolated,
//   no time without heights), heights marked.
// - hike_plans (today and later): the planned route's missing heights filled,
//   so the evening / morning alerts are computed from real heights (dispatch
//   times the route at send time; a changed start sends the morning update).
// Reads SUPABASE_SERVICE_ROLE_KEY from .env.local; prints counts only.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=')
  if (i > 0 && !process.env[l.slice(0, i)]) process.env[l.slice(0, i)] = l.slice(i + 1).trim().replace(/^"|"$/g, '')
}
const imp = p => import(pathToFileURL(join(process.cwd(), p)).href)
const { supabase } = await imp('lib/supabase.js')
const { fillHeights, hasHeights, walkStats } = await imp('lib/route/heights.js')
const { isMultiDay } = await imp('lib/route/timing.js')
const { fetchElevations } = await imp('lib/hike/sources.js')
const { lastUpstreamFailure } = await imp('lib/outlook/http.js')
const DRY = process.env.DRY === '1'

// Open-Meteo counts every point of a request as a call (600 a minute, 5000 an
// hour): one 100-point request every 11 s, and a refused one waits a minute
// and is tried again (for up to ~70 min, past the hourly limit)
const gap = ms => new Promise(r => setTimeout(r, ms))
const getElevations = async pts => {
  for (let tries = 0; tries < 70; tries++) {
    await gap(tries ? 61000 : 11000)
    const got = await fetchElevations(pts)
    if (got) return got
    console.log('  heights refused, waiting a minute:', JSON.stringify(lastUpstreamFailure() ?? null).slice(0, 160))
  }
  return null
}
const noWait = { wait: async () => {} }
const asPoints = list => list.map(([lat, lon, ele]) => ({ lat, lon, ele }))
const asStored = pts => pts.map(p => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5, p.ele == null ? null : Math.round(p.ele)])

// ── route_cache ────────────────────────────────────────────────────────────
const { data: rows, error } = await supabase.from('route_cache').select('peak_key, routes')
if (error) throw new Error(error.message)
const tally = { rows: rows.length, routes: 0, filled: 0, retimed: 0, stillNone: [], multiDay: 0, rowsWritten: 0 }
const time = m => (m == null ? 'no time' : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`)
for (const row of rows) {
  let rowChanged = false
  const routes = []
  for (const r of row.routes ?? []) {
    tally.routes++
    let pts = asPoints(r.points)
    const before = hasHeights(pts)
    if (!before) pts = (await fillHeights(pts, getElevations, noWait)).points
    const ok = hasHeights(pts)
    const stats = walkStats(pts, 'normal', { roundTrip: r.roundTrip !== false })
    const next = { ...r, heights: ok ? (r.heights === 'recorded' ? 'recorded' : 'terrain') : null, ...stats, points: asStored(pts) }
    if (!before && ok) tally.filled++
    if (!ok) tally.stillNone.push(`${row.peak_key} ${r.name ?? r.ref ?? r.id}`)
    if (isMultiDay(next.minutes)) tally.multiDay++
    const moved = next.heights !== r.heights || next.minutes !== r.minutes || next.ascentM !== r.ascentM || next.descentM !== r.descentM || JSON.stringify(next.points) !== JSON.stringify(r.points)
    if (moved) {
      rowChanged = true
      if (before) tally.retimed++
      console.log(`  ${row.peak_key} ${r.name ?? r.ref ?? r.id}: ${time(r.minutes)} ↑${r.ascentM ?? '?'} → ${time(next.minutes)} ↑${next.ascentM ?? '?'}${isMultiDay(next.minutes) ? ' (multi-day)' : ''}`)
    }
    routes.push(moved ? next : r)
  }
  if (rowChanged) {
    tally.rowsWritten++
    if (!DRY) {
      const { error: e } = await supabase.from('route_cache').update({ routes }).eq('peak_key', row.peak_key)
      if (e) throw new Error(`${row.peak_key}: ${e.message}`)
    }
  }
}
console.log(`route_cache: ${tally.rows} peaks, ${tally.routes} routes — heights filled on ${tally.filled}, ${tally.retimed} with heights re-timed, ${tally.stillNone.length} still without heights, ${tally.multiDay} multi-day; ${tally.rowsWritten} rows ${DRY ? 'would be ' : ''}written`)
for (const s of tally.stillNone) console.log('  still no heights:', s)

// ── hike_plans ─────────────────────────────────────────────────────────────
// from yesterday (UTC): a plan for today far east of UTC is still dated so
const today = new Date(Date.now() - 86400e3).toISOString().slice(0, 10)
const { data: plans, error: pe } = await supabase.from('hike_plans').select('id, date, route').gte('date', today).not('route', 'is', null)
if (pe) throw new Error(pe.message)
const pt = { plans: plans.length, filled: 0, none: 0, multiDay: 0, written: 0 }
for (const p of plans) {
  const r = p.route
  if (!Array.isArray(r?.points)) continue
  let pts = asPoints(r.points)
  if (!hasHeights(pts)) {
    pts = (await fillHeights(pts, getElevations, noWait)).points
    if (hasHeights(pts)) pt.filled++
    else pt.none++
    if (JSON.stringify(asStored(pts)) !== JSON.stringify(r.points)) {
      pt.written++
      if (!DRY) {
        const { error: e } = await supabase.from('hike_plans').update({ route: { ...r, points: asStored(pts) } }).eq('id', p.id)
        if (e) throw new Error(`plan ${p.id}: ${e.message}`)
      }
    }
  }
  if (isMultiDay(walkStats(pts, r.pace ?? 'normal', { roundTrip: !!r.roundTrip }).minutes)) pt.multiDay++
}
console.log(`hike_plans (from ${today}) with a route: ${pt.plans} — heights filled on ${pt.filled}, ${pt.none} still without, ${pt.multiDay} multi-day; ${pt.written} ${DRY ? 'would be ' : ''}written`)

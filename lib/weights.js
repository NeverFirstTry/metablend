// Shared weight-update pipeline: load a region's rows, apply per-API score
// deltas, re-normalize, persist. Every calibration path (feedback, calibrate,
// cleanup, station-calibrate, self-calibrate) goes through here so the
// load → score → include-untouched → normalize → persist logic can't drift
// between copies again.
//
// Kept separate from scoring.js so that module stays pure (no supabase import)
// and `node --test` can run scoring.test.js without env vars.

import { supabase } from './supabase.js'
import { rawFactor } from './scoring.js'

// Load weight rows for a region, degrading gracefully on pre-migration schemas
// (no delta_history column, no region column). If the region column exists but
// this region has no rows, fall back to the 'global' rows, then the whole
// table — applyDeltas will upsert proper rows for the region on persist.
async function loadWeights(region) {
  const attempts = [
    { cols: 'id, score, reports, weight, delta_history', region, hasHistory: true, hasRegion: true },
    { cols: 'id, score, reports, weight', region, hasHistory: false, hasRegion: true },
    { cols: 'id, score, reports, weight, delta_history', region: null, hasHistory: true, hasRegion: false },
    { cols: 'id, score, reports, weight', region: null, hasHistory: false, hasRegion: false },
  ]
  for (const a of attempts) {
    let q = supabase.from('api_weights').select(a.cols)
    if (a.region) q = q.eq('region', a.region)
    const { data, error } = await q
    if (error) continue
    if (data?.length) return { rows: data, hasHistory: a.hasHistory, hasRegion: a.hasRegion }
    if (a.region && a.region !== 'global') {
      const { data: g } = await supabase.from('api_weights').select(a.cols).eq('region', 'global')
      if (g?.length) return { rows: g, hasHistory: a.hasHistory, hasRegion: a.hasRegion }
    }
    const { data: all } = await supabase.from('api_weights').select(a.cols)
    return { rows: all ?? [], hasHistory: a.hasHistory, hasRegion: a.hasRegion }
  }
  return { rows: [], hasHistory: false, hasRegion: false }
}

// Apply score deltas to one region's weights and persist the re-normalized set.
//
//   deltaMap: { apiId: delta } or { apiId: [delta, ...] }
//
// Returns the touched APIs as [{ id, deltas, weight }] (weight already
// normalized 0..1), or null when there was nothing to update.
export async function applyDeltas(region, deltaMap) {
  const { rows, hasHistory, hasRegion } = await loadWeights(region)
  if (!rows.length) return null

  const byId = {}
  rows.forEach(r => { byId[r.id] = r })

  const updates = []
  for (const [id, d] of Object.entries(deltaMap)) {
    const cur = byId[id]
    if (!cur) continue
    const deltas = Array.isArray(d) ? d : [d]
    if (!deltas.length) continue
    const score = cur.score + deltas.reduce((s, x) => s + x, 0)
    const reports = cur.reports + deltas.length
    const history = (hasHistory && Array.isArray(cur.delta_history))
      ? [...cur.delta_history, ...deltas].slice(-50)
      : null
    updates.push({ id, score, reports, history, deltas, rawFactor: rawFactor(score, reports, history) })
  }
  if (!updates.length) return null

  // untouched APIs still count toward normalization so weights stay a partition
  const touched = new Set(updates.map(u => u.id))
  rows.forEach(w => {
    if (touched.has(w.id)) return
    const history = (hasHistory && Array.isArray(w.delta_history)) ? w.delta_history : null
    updates.push({ id: w.id, score: w.score, reports: w.reports, history: null, deltas: null, rawFactor: rawFactor(w.score, w.reports, history) })
  })

  const total = updates.reduce((s, u) => s + u.rawFactor, 0)
  for (const u of updates) {
    const payload = {
      score: u.score,
      reports: u.reports,
      weight: u.rawFactor / total,
      updated_at: new Date().toISOString(),
      // untouched rows carry history:null so their stored delta_history is left alone
      ...(u.history !== null ? { delta_history: u.history } : {}),
    }
    if (hasRegion) {
      // Upsert, not update: a plain .update() matching zero rows reports no
      // error, so a missing (id, region) row used to become a silent no-op.
      const { error } = await supabase
        .from('api_weights')
        .upsert({ id: u.id, region, ...payload }, { onConflict: 'id,region' })
      if (error) await supabase.from('api_weights').update(payload).eq('id', u.id)
    } else {
      await supabase.from('api_weights').update(payload).eq('id', u.id)
    }
  }

  return updates
    .filter(u => u.deltas)
    .map(u => ({ id: u.id, deltas: u.deltas, weight: u.rawFactor / total }))
}

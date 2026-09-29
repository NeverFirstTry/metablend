// Learned outlook weights per region × range (h48 = today + tomorrow, d7 =
// the rest of the week). Same scoring and normalization as the live weights
// (buildWeightUpdates), separate table so the "right now" learning stays
// untouched.

import { supabase } from '../supabase.js'
import { buildWeightUpdates } from '../weights.js'
import { sourceName } from '../sources.js'

export const HORIZONS = ['h48', 'd7']

// { h48: { id: weight }, … } for the region, per range falling back to the
// global ranking while the region has no rows yet.
export async function loadOutlookWeights(region) {
  const { data, error } = await supabase
    .from('outlook_weights')
    .select('id, region, horizon, weight')
    .in('region', [...new Set([region, 'global'])])
  if (error || !data) return {}
  const out = {}
  for (const h of HORIZONS) {
    const own = data.filter(r => r.horizon === h && r.region === region)
    const rows = own.length ? own : data.filter(r => r.horizon === h && r.region === 'global')
    if (rows.length) out[h] = Object.fromEntries(rows.map(r => [r.id, r.weight]))
  }
  return out
}

// Apply score deltas to one region × range and persist the re-normalized set
// as one batch upsert. Sources seen for the first time get a fresh row.
export async function applyOutlookDeltas(region, horizon, deltaMap) {
  const { data, error } = await supabase
    .from('outlook_weights')
    .select('id, score, reports, delta_history')
    .eq('region', region)
    .eq('horizon', horizon)
  if (error) throw error
  const rows = [...(data ?? [])]
  for (const id of Object.keys(deltaMap)) {
    if (!rows.some(r => r.id === id)) rows.push({ id, score: 0, reports: 0, delta_history: [] })
  }
  const built = buildWeightUpdates(rows, deltaMap, true)
  if (!built) return 0
  const history = Object.fromEntries(rows.map(r => [r.id, Array.isArray(r.delta_history) ? r.delta_history : []]))
  const now = new Date().toISOString()
  const batch = built.updates.map(u => ({
    id: u.id, region, horizon, name: sourceName(u.id),
    score: u.score, reports: u.reports, weight: u.rawFactor / built.total,
    delta_history: u.history ?? history[u.id], updated_at: now,
  }))
  const { error: upErr } = await supabase.from('outlook_weights').upsert(batch, { onConflict: 'id,region,horizon' })
  if (upErr) throw upErr
  return built.updates.filter(u => u.deltas).length
}

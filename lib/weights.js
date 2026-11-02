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
import { logError } from './log.js'
import { SOURCE_NAMES, sourceName } from './sources.js'

// Load weight rows for a region. A region with no rows yet starts from the
// 'global' rows — applyDeltas upserts proper rows for the region on persist.
const COLS = 'id, name, score, reports, weight, delta_history'
async function loadWeights(region) {
  const { data, error } = await supabase.from('api_weights').select(COLS).eq('region', region)
  if (error) { await logError('weights-load', error, { region }); return [] }
  if (data.length || region === 'global') return data
  const { data: g } = await supabase.from('api_weights').select(COLS).eq('region', 'global')
  return g ?? []
}

// One run per day for a scoring job (calibrate, the Meteostat check): the day
// is claimed before any work. Each run writes a claim (a feedback sentinel row
// the cleanup ages out) and the earliest claim wins, so a second delivery of
// the same cron stops. A run that dies half-way leaves the rest of that day
// unscored — better than scoring the cities it finished twice.
export async function claimDay(marker, date, db = supabase) {
  const claims = () => db.from('feedback').select('id').eq('report_date', date).eq('actual_cond', marker)
  const { data: before } = await claims().limit(1)
  if (before?.length) return false
  const { data: mine, error } = await db.from('feedback')
    .insert({ city: marker, actual_temp: 0, actual_cond: marker, report_date: date, processed: true })
    .select('id').single()
  if (error) throw new Error(`claim ${marker}: ${error.message}`)
  const { data: first } = await claims().order('created_at').order('id').limit(1)
  return first?.[0]?.id === mine.id
}

// Pure core of applyDeltas (unit tested): compute the updated + re-normalized
// rows without touching the database.
//
//   rows:     [{ id, score, reports, delta_history? }]
//   deltaMap: { apiId: delta } or { apiId: [delta, ...] }
//
// Returns { updates, total } or null when no delta matched a known row.
export function buildWeightUpdates(rows, deltaMap) {
  const byId = {}
  rows.forEach(r => { byId[r.id] = r })

  const updates = []
  for (const [id, d] of Object.entries(deltaMap)) {
    // a live source scored here for the first time starts from the table's
    // defaults (score 0, no reports) — new sources get calibrated too;
    // unknown or retired ids are still ignored
    const cur = byId[id] ?? (id in SOURCE_NAMES ? { id, score: 0, reports: 0, delta_history: [] } : null)
    if (!cur) continue
    const deltas = Array.isArray(d) ? d : [d]
    if (!deltas.length) continue
    const score = cur.score + deltas.reduce((s, x) => s + x, 0)
    const reports = cur.reports + deltas.length
    const history = Array.isArray(cur.delta_history) ? [...cur.delta_history, ...deltas].slice(-50) : null
    updates.push({ id, score, reports, history, deltas, rawFactor: rawFactor(score, reports, history) })
  }
  if (!updates.length) return null

  // untouched APIs still count toward normalization so weights stay a partition
  const touched = new Set(updates.map(u => u.id))
  rows.forEach(w => {
    if (touched.has(w.id)) return
    const history = Array.isArray(w.delta_history) ? w.delta_history : null
    updates.push({ id: w.id, score: w.score, reports: w.reports, history: null, deltas: null, rawFactor: rawFactor(w.score, w.reports, history) })
  })

  return { updates, total: updates.reduce((s, u) => s + u.rawFactor, 0) }
}

// Apply score deltas to one region's weights and persist the re-normalized set.
// Returns the touched APIs as [{ id, deltas, weight }] (weight already
// normalized 0..1), or null when there was nothing to update.
export async function applyDeltas(region, deltaMap) {
  const rows = await loadWeights(region)
  if (!rows.length) return null

  const built = buildWeightUpdates(rows, deltaMap)
  if (!built) return null
  const { updates, total } = built
  const now = new Date().toISOString()

  // Persist as ONE batch upsert (bulk rows need uniform keys, so untouched
  // rows write back their existing delta_history unchanged). The old per-row
  // loop was ~17 round-trips per call and pushed the hourly calibration past
  // its function time limit; it survives below as the fallback for a failed batch.
  const existing = {}
  const names = {}
  rows.forEach(r => {
    existing[r.id] = Array.isArray(r.delta_history) ? r.delta_history : []
    names[r.id] = r.name ?? r.id // live DB has NOT NULL on name — the batch INSERT clause must provide it
  })
  const batch = updates.map(u => ({
    id: u.id,
    region,
    name: names[u.id] ?? sourceName(u.id), // a new source has no row yet
    score: u.score,
    reports: u.reports,
    weight: u.rawFactor / total,
    updated_at: now,
    delta_history: u.history ?? existing[u.id],
  }))
  const { error: batchErr } = await supabase.from('api_weights').upsert(batch, { onConflict: 'id,region' })
  // A failing batch falls back to per-row round-trips — that's a performance
  // regression worth knowing about, not just surviving.
  if (batchErr) {
    await logError('weights-batch-upsert', batchErr, { region, rows: batch.length })
    for (const u of updates) {
      const payload = {
        score: u.score,
        reports: u.reports,
        weight: u.rawFactor / total,
        updated_at: now,
        // untouched rows carry history:null so their stored delta_history is left alone
        ...(u.history !== null ? { delta_history: u.history } : {}),
      }
      // Upsert, not update: a plain .update() matching zero rows reports no
      // error, so a missing (id, region) row used to become a silent no-op.
      await supabase.from('api_weights').upsert({ id: u.id, region, name: names[u.id] ?? sourceName(u.id), ...payload }, { onConflict: 'id,region' })
    }
  }

  return updates
    .filter(u => u.deltas)
    .map(u => ({ id: u.id, deltas: u.deltas, weight: u.rawFactor / total }))
}

import { supabase } from './supabase.js'

// One row per run of a scheduled job (job_runs, supabase/job-runs.sql): when it started, how long
// it took, the status it answered, the error text if it threw, and a compact summary of its JSON
// answer. Wrapped inside withErrorLog, so a throw is recorded as 500 with its message and still
// reaches the error log. Unauthorised and throttled calls (401, 403, 429) are not runs. Never fails
// the job: a missing table (before supabase/job-runs.sql ran) or a refused insert is ignored.
const QUIET = new Set([401, 403, 429])

// Numbers, booleans and short strings stay; an array becomes its length; a `results` array of
// per-city outcomes adds a tally of its `skipped` reasons (the station calibration).
export function summarize(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const out = {}
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string') out[k] = v.slice(0, 80)
    else if (Array.isArray(v)) {
      out[k] = v.length
      if (k === 'results') {
        const skipped = {}
        for (const r of v) if (r && typeof r.skipped === 'string') skipped[r.skipped] = (skipped[r.skipped] ?? 0) + 1
        if (Object.keys(skipped).length) out.skipped = skipped
      }
    }
  }
  return out
}

export function withJobLog(job, handler, { db = supabase, now = Date.now } = {}) {
  return async (request, ctx) => {
    const started = now()
    const record = async (status, error, summary) => {
      try {
        const row = { job, started_at: new Date(started).toISOString(), duration_ms: Math.max(0, now() - started), status_code: status, error: error ? String(error).slice(0, 500) : null, summary }
        const { error: e } = await db.from('job_runs').insert(row)
        if (e && e.code !== 'PGRST205') console.error('[job-log]', job, e.message)
      } catch (e) { console.error('[job-log]', job, e?.message ?? e) }
    }
    let res
    try { res = await handler(request, ctx) } catch (e) { await record(500, e?.message ?? e, null); throw e }
    if (!QUIET.has(res.status)) await record(res.status, null, summarize(await res.clone().json().catch(() => null)))
    return res
  }
}

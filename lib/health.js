// What /api/health reports as a problem. An outside monitor asks that address every five minutes and
// sends a mail when it answers 503, so nothing here sends mail and nothing runs in a visitor's browser.
// The limits come from the week of 2026-11-05 to 2026-11-12 (error_log and job_runs on production):
//   failures of outside services per 15 minutes (scopes ending .upstream or .partial): highest 30
//   errors of our own routes (a scope without a dot, written by withErrorLog): 0 in every quarter hour
//     but one, the forecast outage of 2026-11-09 with 22
//   longest gap between runs: warnings-refresh 0.5 h, push-dispatch 0.3 h, station-calibrate 1.0 h,
//     cleanup and calibrate 24 h
// Each limit sits clearly above the week's normal, so a quiet week sends no mail. Pure.

export const WINDOW_MIN = 15
export const LIMITS = {
  upstream: 45, // failures of outside services in 15 minutes (the week's highest: 30)
  own: 10, // errors of our own routes in 15 minutes (normal: 0; the outage: 22)
  // a scheduled job is overdue after this many minutes without a run
  overdue: { 'warnings-refresh': 60, 'push-dispatch': 60, 'station-calibrate': 150, cleanup: 26 * 60, calibrate: 26 * 60 },
}
// notes the site writes to the same table that are not failures
const NOTES = new Set(['geocode.upstream', 'open-meteo.quota', 'warnings.database'])

// errors: [{ scope }] of the last WINDOW_MIN minutes. jobs: [{ job, started_at, status_code }] of the last
// 27 hours. Returns the problems as short texts; an empty list means all is well.
export function healthProblems({ errors, jobs, dbDown = false, now = Date.now() }) {
  if (dbDown || !Array.isArray(errors) || !Array.isArray(jobs)) return ['the database did not answer']
  const out = []
  const real = errors.filter(e => !NOTES.has(e.scope))
  const upstream = real.filter(e => /\.(upstream|partial)$/.test(e.scope)).length
  const own = real.filter(e => !e.scope.includes('.')).length
  if (own > LIMITS.own) out.push(`${own} errors of our own routes in ${WINDOW_MIN} minutes (limit ${LIMITS.own})`)
  if (upstream > LIMITS.upstream) out.push(`${upstream} failed requests to outside services in ${WINDOW_MIN} minutes (limit ${LIMITS.upstream})`)
  for (const [job, minutes] of Object.entries(LIMITS.overdue)) {
    const runs = jobs.filter(j => j.job === job).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    const last = runs[0]
    if (!last || now - Date.parse(last.started_at) > minutes * 60_000) out.push(`the job ${job} has not run for over ${minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} minutes`}`)
    else if (last.status_code !== 200) out.push(`the job ${job} ended with ${last.status_code}`)
  }
  return out
}

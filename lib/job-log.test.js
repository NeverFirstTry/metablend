// Every scheduled job writes one row per run to job_runs (supabase/job-runs.sql): when it started, how
// long it took, the status it answered, the error if it threw, and a compact summary of its answer.
// pg_net keeps HTTP answers only a few hours, so a failed night run was invisible by morning
// (2026-11-09); with the table, a read-only check covers any night. Logging never fails the job.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { withJobLog, summarize } = await import('./job-log.js')

const fakeDb = (answer = { error: null }) => {
  const rows = []
  return { rows, from: table => ({ insert: async row => { rows.push({ table, ...row }); return answer } }) }
}
const clock = (...ticks) => () => ticks.shift() ?? 1000
const req = () => new Request('https://metablend.app/api/job')

test('summarize — numbers, booleans and short strings stay, arrays become their length, per-city skip reasons are tallied', () => {
  const body = { calibrated: 6, since: '2026-11-09T11:17:00.298Z', radiusKm: 60, ok: true, results: [
    { city: 'Lienz', skipped: 'no fresh METAR within 60km' }, { city: 'Ainet', skipped: 'no fresh METAR within 60km' }, { city: 'Vienna', stations: 2, apis: [] },
  ], nested: { deep: 1 } }
  assert.deepEqual(summarize(body), { calibrated: 6, since: '2026-11-09T11:17:00.298Z', radiusKm: 60, ok: true, results: 3, skipped: { 'no fresh METAR within 60km': 2 } })
  assert.equal(summarize(null), null)
  assert.equal(summarize([1, 2]), null)
})

test('withJobLog — a run that answers 200 is recorded with its duration and summary', async () => {
  const db = fakeDb()
  const get = withJobLog('station-calibrate', async () => Response.json({ calibrated: 10, results: [{ city: 'Lienz', skipped: 'no fresh METAR within 60km' }] }), { db, now: clock(1000, 1450) })
  const res = await get(req())
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { calibrated: 10, results: [{ city: 'Lienz', skipped: 'no fresh METAR within 60km' }] }) // the answer is untouched
  assert.deepEqual(db.rows, [{ table: 'job_runs', job: 'station-calibrate', started_at: '1970-01-01T00:00:01.000Z', duration_ms: 450, status_code: 200, error: null, summary: { calibrated: 10, results: 1, skipped: { 'no fresh METAR within 60km': 1 } } }])
})

test('withJobLog — a throw is recorded as 500 with its message and still thrown for withErrorLog', async () => {
  const db = fakeDb()
  const get = withJobLog('cleanup', async () => { throw new Error('database away') }, { db, now: clock(5000, 5020) })
  await assert.rejects(get(req()), /database away/)
  assert.equal(db.rows.length, 1)
  assert.equal(db.rows[0].status_code, 500)
  assert.equal(db.rows[0].error, 'database away')
  assert.equal(db.rows[0].duration_ms, 20)
  assert.equal(db.rows[0].summary, null)
})

test('withJobLog — an unauthorised or throttled call is not a run; a non-JSON answer has no summary; a missing table is ignored', async () => {
  const db = fakeDb()
  for (const status of [401, 403, 429]) await withJobLog('calibrate', async () => Response.json({ error: 'no' }, { status }), { db })(req())
  assert.deepEqual(db.rows, [])
  await withJobLog('calibrate', async () => new Response('plain text'), { db })(req())
  assert.equal(db.rows.length, 1)
  assert.equal(db.rows[0].summary, null)
  const missing = fakeDb({ error: { code: 'PGRST205', message: 'relation job_runs does not exist' } })
  const res = await withJobLog('calibrate', async () => Response.json({ ok: true }), { db: missing })(req())
  assert.equal(res.status, 200) // the job's answer stands whatever the log does
})

test('the five scheduled jobs write to job_runs, the cleanup removes rows after 14 days, the schema list has the table', () => {
  const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  for (const [f, job] of [['app/api/cleanup/route.js', 'cleanup'], ['app/api/calibrate/route.js', 'calibrate'], ['app/api/push/dispatch/route.js', 'push-dispatch'], ['app/api/warnings/refresh/route.js', 'warnings-refresh'], ['app/api/station-calibrate/route.js', 'station-calibrate']]) {
    assert.ok(read(f).includes(`withJobLog('${job}', async (request) => {`), `${f} runs through withJobLog('${job}')`)
  }
  assert.match(read('app/api/cleanup/route.js'), /from\('job_runs'\)\.delete\(\)\.lt\('started_at', new Date\(Date\.now\(\) - 14 \* 86_400_000\)/)
  assert.ok(read('scripts/lib/dev-schema.mjs').includes("'job-runs.sql'"))
  assert.match(read('supabase/job-runs.sql'), /create table if not exists public\.job_runs/)
})

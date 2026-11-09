// Every scheduled job writes one row per run to job_runs (supabase/job-runs.sql): when it started, how
// long it took, the status it answered, the error if it threw, and a compact summary of its answer.
// pg_net keeps HTTP answers only a few hours, so a failed night run was invisible by morning
// (2026-11-09); with the table, a read-only check covers any night. Logging never fails the job.
import './test-jsx-hooks.js'
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

// The five scheduled jobs, called for real with every outside call faked (lib/test-route-fakes.js):
// each run leaves one job_runs row under its own name, and an unauthorised call leaves none.
const { seen, reset, jobRequest } = await import('./test-route-fakes.js')
const JOBS = [
  ['cleanup', await import('../app/api/cleanup/route.js'), '/api/cleanup'],
  ['calibrate', await import('../app/api/calibrate/route.js'), '/api/calibrate'],
  ['push-dispatch', await import('../app/api/push/dispatch/route.js'), '/api/push/dispatch'],
  ['warnings-refresh', await import('../app/api/warnings/refresh/route.js'), '/api/warnings/refresh'],
  ['station-calibrate', await import('../app/api/station-calibrate/route.js'), '/api/station-calibrate'],
]
const jobRows = () => seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/job_runs')).map(c => JSON.parse(c.body))

for (const [job, { GET }, path] of JOBS) {
  test(`${job}: a run writes one job_runs row under its own name; an unauthorised call writes none`, async () => {
    reset()
    const res = await GET(jobRequest(path))
    assert.equal(res.status, 200, `${job}: a normal run`)
    const rows = jobRows()
    assert.equal(rows.length, 1, `${job}: one row`)
    assert.equal(rows[0].job, job)
    assert.equal(rows[0].status_code, res.status)
    reset()
    const denied = await GET(new Request(`https://metablend.app${path}`))
    assert.ok([401, 503].includes(denied.status), `${job}: refused without its secret`)
    assert.deepEqual(jobRows(), [], `${job}: a refused call is not a run`)
  })
}

test('cleanup: job_runs rows go after 14 days', async () => {
  const { GET } = await import('../app/api/cleanup/route.js')
  reset()
  const before = Date.now()
  await GET(jobRequest('/api/cleanup'))
  const after = Date.now()
  const prune = seen.filter(c => c.method === 'DELETE' && c.url.includes('/rest/v1/job_runs?'))
  assert.equal(prune.length, 1)
  const at = Date.parse(prune[0].url.match(/started_at=lt\.([^&]+)/)[1])
  const DAY = 86_400_000
  assert.ok(at >= before - 14 * DAY && at <= after - 14 * DAY, `cutoff ${new Date(at).toISOString()} is 14 days back`)
})

test('the schema list has the job_runs table', () => {
  const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  assert.ok(read('scripts/lib/dev-schema.mjs').includes("'job-runs.sql'"))
  assert.match(read('supabase/job-runs.sql'), /create table if not exists public\.job_runs/)
})

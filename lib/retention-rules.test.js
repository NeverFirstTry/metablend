// How long the nightly cleanup keeps the logs (owner, 2026-11-12): blend history 7 days, the error log 14
// days and its notes 7, the station log 30 (owner, 2026-11-14: back from 14). The cleanup route is called for real with every outside call
// faked (lib/test-route-fakes.js); what it asks the database to delete is read from the recorded calls.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, jobRequest } from './test-route-fakes.js'

const DAY = 86_400_000
// the age, in days, of the cutoff a DELETE on `table` carries in `column`
const cutoffs = (table, column, now) => seen
  .filter(c => c.method === 'DELETE' && c.url.includes(`/rest/v1/${table}?`))
  .map(c => ({ days: Math.round((now - Date.parse(decodeURIComponent(c.url.match(new RegExp(`${column}=lt\\.([^&]+)`))[1]))) / DAY * 10) / 10, scoped: /scope=in\./.test(c.url), url: decodeURIComponent(c.url) }))

test('cleanup: blend history goes after 7 days, errors after 14, notes after 7, the station log after 30', async () => {
  const { GET } = await import('../app/api/cleanup/route.js')
  reset()
  await GET(jobRequest('/api/cleanup'))
  const now = Date.now()
  assert.deepEqual(cutoffs('consensus_history', 'created_at', now).map(c => c.days), [7])
  const errors = cutoffs('error_log', 'created_at', now)
  assert.deepEqual(errors.filter(c => !c.scoped).map(c => c.days), [14], 'every row of the error log after 14 days')
  const notes = errors.filter(c => c.scoped)
  assert.deepEqual(notes.map(c => c.days), [7], 'the notes after 7')
  for (const scope of ['geocode.upstream', 'open-meteo.quota', 'warnings.database']) assert.ok(notes[0].url.includes(scope), `${scope} is a note`)
  // the shadow run's final report of 2026-12-05 reads four weeks of it (docs/shadow-run.md); 14 days cut it to two
  assert.deepEqual(cutoffs('station_errors', 'created_at', now).map(c => c.days), [30])
  // unchanged: the job log 14 days, the request counter 90
  assert.deepEqual(cutoffs('job_runs', 'started_at', now).map(c => c.days), [14])
  // a calendar day: 90 days and the hours since midnight UTC (from 22:48 UTC that rounds to 91.0, which a floor read as 91 days)
  assert.deepEqual(cutoffs('open_meteo_calls', 'day', now).map(c => c.days >= 90 && c.days <= 91), [true])
})

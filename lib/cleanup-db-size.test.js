// The nightly job measures the database (the plan holds 500 MB) and says so in its summary, so the growth
// per day can be read from the job log. It raises no alarm: the alarm at 400 MB is the address
// /api/health/db's (lib/health-db.test.js), which a monitor of its own asks, so the main health check never
// fails for the size (owner, 2026-11-20). The function database_size (supabase/database-size.sql) may not
// exist yet: the job then runs as before. The route is called for real with every outside call faked.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset, answerWith, json, jobRequest } from './test-route-fakes.js'

const { GET: cleanup } = await import('../app/api/cleanup/route.js')
const MB = 1024 * 1024
const size = answer => call => (call.url.includes('/rest/v1/rpc/database_size') ? answer : undefined)
const notes = () => seen.filter(c => c.method === 'POST' && c.url.includes('/rest/v1/error_log') && /database\.size/.test(c.body ?? ''))

test('348 MB: the size is in the job\'s answer, no note', async () => {
  reset(); answerWith(size(json(348 * MB)))
  const res = await cleanup(jobRequest('/api/cleanup'))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).databaseMb, 348)
  assert.equal(notes().length, 0)
})

test("400 MB or more: the size is in the job's answer and the job leaves no note for the main health check", async () => {
  reset(); answerWith(size(json(412 * MB)))
  const res = await cleanup(jobRequest('/api/cleanup'))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).databaseMb, 412)
  assert.equal(notes().length, 0)
})

test('the function is not in the database yet: the job runs as before, without a size', async () => {
  reset(); answerWith(size(json({ code: 'PGRST202', message: 'Could not find the function public.database_size' }, 404)))
  const res = await cleanup(jobRequest('/api/cleanup'))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).databaseMb, null)
  assert.equal(notes().length, 0)
})

// /api/health: what counts as a problem (lib/health.js). The limits come from a week of production's
// own numbers; the cases below are that week's normal, its one outage, and jobs that stop.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reset, answerWith, json } from './test-route-fakes.js'
import { healthProblems, LIMITS } from './health.js'

const NOW = Date.parse('2026-11-12T15:00:00Z')
const ago = min => new Date(NOW - min * 60_000).toISOString()
const run = (job, min, status_code = 200) => ({ job, started_at: ago(min), status_code })
const JOBS = [run('warnings-refresh', 10), run('push-dispatch', 12), run('station-calibrate', 43), run('cleanup', 600), run('calibrate', 540)]
const rows = (scope, n) => Array.from({ length: n }, () => ({ scope }))

test('a normal quarter hour is no problem: the week’s busiest (30 failed outside requests) and the notes', () => {
  const errors = [...rows('hike.upstream', 19), ...rows('forecast.partial', 8), ...rows('outlook.upstream', 3), ...rows('geocode.upstream', 36), ...rows('open-meteo.quota', 14), ...rows('warnings.database', 1)]
  assert.deepEqual(healthProblems({ errors, jobs: JOBS, now: NOW }), [])
})

test('the forecast outage of 2026-11-09 (22 errors of our own route in a quarter hour) is a problem', () => {
  const p = healthProblems({ errors: rows('forecast', 22), jobs: JOBS, now: NOW })
  assert.equal(p.length, 1)
  assert.match(p[0], /^22 errors of our own routes in 15 minutes/)
  assert.deepEqual(healthProblems({ errors: rows('forecast', LIMITS.own), jobs: JOBS, now: NOW }), [], 'at the limit: not yet')
})

test('many failed requests to outside services are a problem', () => {
  const p = healthProblems({ errors: [...rows('hike.upstream', 30), ...rows('forecast.partial', 16)], jobs: JOBS, now: NOW })
  assert.match(p[0], /^46 failed requests to outside services/)
})

// 2026-11-09 to 11-13 on production: about one such forecast a day on its own, three bursts of 3 within a
// minute, one of 8. An outage that lasts gives one per place every 2 minutes.
test('forecasts that lost every Open-Meteo source: up to 3 in a quarter hour are no problem, the fourth is', () => {
  const thin = n => [...rows('forecast.lost', n), ...rows('forecast.partial', n)] // each one is in the thin-blend log too
  assert.deepEqual(healthProblems({ errors: thin(1), jobs: JOBS, now: NOW }), [])
  assert.deepEqual(healthProblems({ errors: thin(LIMITS.lost), jobs: JOBS, now: NOW }), [], 'at the limit: not yet')
  assert.deepEqual(healthProblems({ errors: thin(4), jobs: JOBS, now: NOW }), ['4 forecasts lost every Open-Meteo source in 15 minutes (limit 3)'])
  assert.equal(LIMITS.lost, 3)
})

test('a job that stopped or failed is a problem, each with its own patience', () => {
  const jobs = [run('warnings-refresh', 61), run('push-dispatch', 12, 500), run('station-calibrate', 43), run('cleanup', 27 * 60), run('calibrate', 540)]
  assert.deepEqual(healthProblems({ errors: [], jobs, now: NOW }), [
    'the job warnings-refresh has not run for over 60 minutes',
    'the job push-dispatch ended with 500',
    'the job cleanup has not run for over 26 hours',
  ])
  assert.match(healthProblems({ errors: [], jobs: JOBS.filter(j => j.job !== 'calibrate'), now: NOW })[0], /calibrate has not run/)
})

test('no answer from the database is the one problem reported', () => {
  assert.deepEqual(healthProblems({ errors: null, jobs: null, dbDown: true, now: NOW }), ['the database did not answer'])
})

test('GET /api/health: 200 and ok when all is well, 503 with the problems when not, never cached; an answer is kept a minute', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW })
  const { GET } = await import('../app/api/health/route.js')
  const ask = ip => GET(new Request('https://metablend.app/api/health', { headers: { 'x-forwarded-for': ip } }))
  let errors = []
  reset(); answerWith(({ url }) => (url.includes('/rest/v1/job_runs') ? json(JOBS) : url.includes('/rest/v1/error_log') ? json(errors) : undefined))
  const well = await ask('203.0.113.80')
  assert.equal(well.status, 200)
  assert.equal(well.headers.get('cache-control'), 'no-store')
  assert.deepEqual((await well.json()).problems, [])
  errors = rows('forecast', 12)
  assert.equal((await ask('203.0.113.80')).status, 200, 'within the minute the kept answer comes back')
  t.mock.timers.tick(61_000)
  const ill = await ask('203.0.113.81')
  assert.equal(ill.status, 503)
  const body = await ill.json()
  assert.equal(body.ok, false)
  assert.match(body.problems[0], /12 errors of our own routes/)
})

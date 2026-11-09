// Our own count of Open-Meteo requests, weighted the way Open-Meteo counts API calls (their page: one
// call per request; more than 10 weather variables or more than two weeks for one location count
// fractionally, 15 variables over 2 weeks = 1.5, over 4 weeks = 3.0; several locations or models are
// not covered, so each location and each model's set of variables counts as its own here). The free
// tier allows 10,000 a day per IP: an error-log entry at 70 % and 90 %, once each per UTC day.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { callWeight, quotaAlert, countRequest, resetAlerts } = await import('./open-meteo.js')

const OM = 'https://api.open-meteo.com/v1/forecast?latitude=46.8&longitude=12.8'

test('callWeight — their two examples: 15 variables over 2 weeks is 1.5 calls, over 4 weeks 3.0', () => {
  const vars = Array.from({ length: 15 }, (_, i) => `v${i}`).join(',')
  assert.equal(callWeight(`https://archive-api.open-meteo.com/v1/archive?latitude=1&longitude=2&start_date=2026-10-01&end_date=2026-10-14&hourly=${vars}`), 1.5)
  assert.equal(callWeight(`https://archive-api.open-meteo.com/v1/archive?latitude=1&longitude=2&start_date=2026-10-01&end_date=2026-10-28&hourly=${vars}`), 3)
})

test('callWeight — our own requests: the plain ones are one call, the model and multi-location ones more', () => {
  assert.equal(callWeight(`${OM}&current=temperature_2m,apparent_temperature,precipitation_probability,windspeed_10m,weathercode&timezone=auto`), 1) // the forecast's current reading
  assert.equal(callWeight(`${OM}&hourly=a,b,c,d,e&models=m1,m2,m3,m4,m5,m6,m7,m8,m9,m10`), 5) // 5 variables × 10 models, 7 days
  assert.equal(callWeight(`${OM}&hourly=a,b,c,d,e,f,g,h&daily=i,j,k,l&models=m1,m2,m3,m4,m5,m6,m7,m8,m9,m10&forecast_days=16`), 13.71) // the outlook
  assert.equal(callWeight(`${OM}&hourly=a,b,c,d,e,f,g,h&daily=sunrise,sunset&models=m1,m2,m3,m4,m5,m6,m7,m8,m9,m10&forecast_days=8`), 10) // a summit
  assert.equal(callWeight('https://api.open-meteo.com/v1/forecast?latitude=1,2,3,4,5,6&longitude=1,2,3,4,5,6&hourly=a,b,c,d,e,f,g,h&daily=i,j&models=m1,m2,m3&forecast_days=8'), 18) // a route's six stage points, three models
  assert.equal(callWeight('https://api.open-meteo.com/v1/elevation?latitude=' + Array(100).fill('47').join(',') + '&longitude=' + Array(100).fill('12').join(',')), 100)
  assert.equal(callWeight('https://geocoding-api.open-meteo.com/v1/search?name=Lienz&count=10&language=de'), 1)
  assert.equal(callWeight(`${OM}&minutely_15=precipitation&forecast_minutely_15=10&models=a,b,c,d,e,f,g,h`), 1) // the nowcast: 1 variable × 8 models = 0.8 → 1
  assert.equal(callWeight('not a url'), 1)
})

test('quotaAlert — a message once at 70 % and once at 90 % of 10,000 per UTC day, 90 covering 70, fresh the next day', () => {
  resetAlerts()
  const T = Date.parse('2026-11-10T13:05:00Z')
  assert.equal(quotaAlert(6999, T), null)
  assert.match(quotaAlert(7000, T), /7000 of 10000 .* \(70 %\) by 13:05 UTC/)
  assert.equal(quotaAlert(7500, T + 60_000), null)
  assert.match(quotaAlert(9100, T + 120_000), /\(90 %\)/)
  assert.equal(quotaAlert(9500, T + 180_000), null)
  assert.match(quotaAlert(9200, Date.parse('2026-11-11T00:10:00Z')), /\(90 %\)/) // a new day
  resetAlerts()
  assert.match(quotaAlert(9200, T), /\(90 %\)/) // straight to 90 covers 70 too
  assert.equal(quotaAlert(7100, T + 1000), null)
  resetAlerts()
})

test('countRequest — one bump per request in its UTC hour with the weight, the alert logged when the day total says so, nothing thrown', async () => {
  resetAlerts()
  const bumps = [], logged = []
  const db = { rpc: async (fn, args) => { bumps.push([fn, args]); return { data: args.p_calls > 4 ? 7000 : 10, error: null } } }
  const log = async (scope, err, meta) => logged.push([scope, err.message, meta])
  const T = Date.parse('2026-11-10T09:17:00Z')
  await countRequest(`${OM}&current=temperature_2m`, { db, now: T, log })
  assert.deepEqual(bumps, [['bump_open_meteo_calls', { p_day: '2026-11-10', p_hour: 9, p_calls: 1 }]])
  assert.deepEqual(logged, [])
  await countRequest(`${OM}&hourly=a,b,c,d,e&models=m1,m2,m3,m4,m5,m6,m7,m8,m9,m10`, { db, now: T, log })
  assert.equal(bumps[1][1].p_calls, 5)
  assert.equal(logged.length, 1)
  assert.equal(logged[0][0], 'open-meteo.quota')
  const missing = { rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } }) }
  // the function may not exist yet (its SQL not run): logged once per instance, not per request
  await countRequest(`${OM}&current=temperature_2m`, { db: missing, now: T, log })
  await countRequest(`${OM}&current=temperature_2m`, { db: missing, now: T, log })
  assert.deepEqual(logged.filter(([scope]) => scope === 'open-meteo.count').map(([, msg]) => msg), ['function not found'])
  const broken = { rpc: async () => { throw new Error('network') } }
  await countRequest(`${OM}&current=temperature_2m`, { db: broken, now: T, log })
  resetAlerts()
})

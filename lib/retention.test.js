import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { supabase } = await import('./supabase.js')
const { purgeShortLived, SHORT_LIVED } = await import('./retention.js')

// WeatherAPI's terms cap caching of current conditions at 60 minutes: its
// rows live only until the hourly station calibration has scored them.
test('purgeShortLived — deletes the short-lived sources\' forecast rows from before the run, nothing else', async () => {
  const real = globalThis.fetch, seen = []
  globalThis.fetch = async (url, init) => {
    seen.push({ url: decodeURIComponent(String(url)), method: init.method })
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try { await purgeShortLived(supabase, '2026-11-08T10:00:00.000Z') } finally { globalThis.fetch = real }
  assert.deepEqual(SHORT_LIVED, ['weatherapi'])
  assert.deepEqual(seen, [{ url: 'https://proj.supabase.co/rest/v1/forecasts?api_id=in.(weatherapi)&created_at=lt.2026-11-08T10:00:00.000Z', method: 'DELETE' }])
})

test('the hourly station calibration purges them after scoring, on both of its exits', () => {
  const src = fs.readFileSync(new URL('../app/api/station-calibrate/route.js', import.meta.url), 'utf8')
  assert.equal((src.match(/await purgeShortLived\(supabase, runStart\)/g) ?? []).length, 2)
})

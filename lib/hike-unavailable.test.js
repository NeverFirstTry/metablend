// Open-Meteo refusing every summit request (429 "Too many concurrent requests" in bursts, 2026-11-09) must
// not become a 502: /api/hike answers 200 with unavailable: true, never cached; the peak view shows its
// retry card, the summit page keeps throwing (crawlers retry, no empty page is cached), push dispatch and
// the widget treat the answer as missing. getJson's 429 retry is tested in lib/outlook/http.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('an unavailable summit forecast is a 200 that nothing caches, and every consumer treats it as missing', () => {
  // source-match-ok: one contract across a route and four consumers; only dispatch is called in a test, no route harness yet
  assert.match(read('app/api/hike/route.js'), /if \(!payload\.hourly\.length\) return noStore\(\{ \.\.\.payload, unavailable: true \}, 200\)/)
  assert.match(read('app/mountains/[peak]/page.js'), /if \(!res\.ok \|\| body\.unavailable\) throw/)
  assert.match(read('app/components/hike/PeakView.jsx'), /data\?\.unavailable \? Promise\.reject/)
  assert.match(read('lib/push/dispatch.js'), /got\?\.unavailable \? null : got/)
  assert.match(read('app/api/app-widget/route.js'), /!hike\.json \|\| hike\.json\.unavailable/)
  assert.match(read('lib/outlook/models.js'), /const core = await get\(url\(CORE_MODELS\), \{ cache: 'no-store', ms: 7000, retries: 1/)
})

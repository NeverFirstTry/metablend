// Open-Meteo refusing every summit request (429 "Too many concurrent requests" in bursts, 2026-11-09) must
// not become a 502: /api/hike answers 200 with unavailable: true, never cached; the summit page keeps
// throwing (crawlers retry, no empty page is cached), the widget and push dispatch treat the answer as
// missing, the peak view shows its retry card. Called for real with every outside call faked
// (lib/test-route-fakes.js); the site's own /api/hike, which the page and the widget fetch through
// SELF_BASE, is the real route. getJson's 429 retry is tested in lib/outlook/http.test.js, push
// dispatch with an unavailable answer in lib/push/dispatch.test.js.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { seen, reset, answerWith, json } = await import('./test-route-fakes.js')
const { GET: hike } = await import('../app/api/hike/route.js')
const { GET: widget } = await import('../app/api/app-widget/route.js')
const { default: SummitPageRoute } = await import('../app/mountains/[peak]/page.js')
const { hikeApiPath } = await import('./hike/params.js')
const featured = JSON.parse(readFileSync(new URL('./hike/featured.json', import.meta.url), 'utf8'))
const PEAK = featured.find(p => p.kind !== 'hut')

// Open-Meteo refuses everything; the site's own summit API is the real route, whichever base asks it
// (the page uses SELF_BASE, the widget the request's own origin on localhost)
const SELF = /^http:\/\/(self\.test|localhost:3000)\/api\//
const refusing = ({ url }) => {
  if (url.includes('open-meteo.com')) return new Response('{"reason":"Too many concurrent requests"}', { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '0' } })
  if (SELF.test(url) && url.includes('/api/hike?')) return hike(new Request(url, { headers: { 'x-calibrate-key': 'calibrate-secret' } }))
  if (SELF.test(url) && url.includes('/api/avalanche?')) return json({})
}
// the real summit route ran and Open-Meteo refused it: the answer is unavailable, not missing
const askedAndRefused = () => {
  assert.ok(seen.some(c => SELF.test(c.url) && c.url.includes('/api/hike?')), 'the summit API was asked')
  assert.ok(seen.some(c => c.url.includes('open-meteo.com')), 'which asked Open-Meteo')
}

test('/api/hike: Open-Meteo refusing every request is a 200 with unavailable: true that nothing caches', async () => {
  reset(); answerWith(refusing)
  const res = await hike(new Request(`https://metablend.app${hikeApiPath(PEAK)}`, { headers: { 'x-forwarded-for': '203.0.113.9' } }))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.unavailable, true)
  assert.deepEqual(body.hourly, [])
  assert.equal(res.headers.get('cache-control'), 'no-store')
})

test('the summit page throws on an unavailable answer, so no empty page is cached and crawlers retry', async () => {
  reset(); answerWith(refusing)
  await assert.rejects(SummitPageRoute({ params: Promise.resolve({ peak: PEAK.id }) }), /hike api unavailable/)
  askedAndRefused()
})

test('the widget treats an unavailable summit forecast as missing: an error nothing caches', async () => {
  reset(); answerWith(refusing)
  const q = new URLSearchParams({ kind: 'hike', name: PEAK.name, lat: PEAK.lat, lon: PEAK.lon, elev: PEAK.elev, date: new Date().toISOString().slice(0, 10), lang: 'en', unit: 'C' })
  const res = await widget(new Request(`http://localhost:3000/api/app-widget?${q}`, { headers: { 'x-forwarded-for': '203.0.113.10' } }))
  assert.equal(res.status, 502)
  assert.match((await res.json()).error, /unavailable/)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  askedAndRefused()
})

test('the peak view shows its retry card for an unavailable answer', () => {
  // source-match-ok: PeakView fetches in an effect after hydration, and these tests have no DOM to run one
  assert.match(readFileSync(new URL('../app/components/hike/PeakView.jsx', import.meta.url), 'utf8'), /data\?\.unavailable \? Promise\.reject/)
})

test('the core models request retries once before the answer counts as unavailable', () => {
  assert.match(readFileSync(new URL('./outlook/models.js', import.meta.url), 'utf8'), /const core = await get\(url\(CORE_MODELS\), \{ cache: 'no-store', ms: 7000, retries: 1/)
})

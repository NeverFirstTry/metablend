// Audit L9: the share card, the RSS feed, the heatmap and the rankings had no limit per address. A new
// name on the share card costs a forecast and an outlook; the other three cost database reads once a
// request gets past the CDN. Routes called for real with every outside call faked (lib/test-route-fakes.js).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seen, reset } from './test-route-fakes.js'

const { GET: card } = await import('../app/api/og/city/route.js')
const { GET: rss } = await import('../app/api/rss/route.js')
const { GET: heatmap } = await import('../app/api/heatmap/route.js')
const { GET: rankings } = await import('../app/api/leaderboard/route.js')

const ask = (route, path, ip) => route(new Request(`https://metablend.app${path}`, { headers: { 'x-forwarded-for': ip } }))
const upstream = () => seen.filter(c => /\/api\/(forecast|outlook)\?/.test(c.url)).length
const reads = table => seen.filter(c => c.url.includes(`/rest/v1/${table}`)).length

test('share card: ten new cards a minute per address ask the forecast and outlook, the eleventh is the plain card', async () => {
  reset()
  for (let i = 0; i < 10; i++) await ask(card, `/api/og/city?name=Place${i}`, '203.0.113.60')
  assert.equal(upstream(), 20, 'a forecast and an outlook for each of the ten')
  const res = await ask(card, '/api/og/city?name=Place10', '203.0.113.60')
  assert.equal(upstream(), 20, 'nothing asked for the eleventh')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  await ask(card, '/api/og/city?name=Place11', '203.0.113.61')
  assert.equal(upstream(), 22, 'another address is not affected')
})

test('RSS: thirty a minute per address, then 429 with Retry-After; the feed is kept by the CDN for 15 minutes', async () => {
  reset()
  const first = await ask(rss, '/api/rss?city=Wien', '203.0.113.62')
  assert.equal(first.status, 200)
  assert.match(first.headers.get('cache-control'), /s-maxage=900\b/)
  for (let i = 1; i < 30; i++) await ask(rss, `/api/rss?city=Ort${i}`, '203.0.113.62')
  assert.equal(reads('consensus_history'), 30)
  const over = await ask(rss, '/api/rss?city=Ort30', '203.0.113.62')
  assert.equal(over.status, 429)
  assert.equal(over.headers.get('retry-after'), '60')
  assert.equal(reads('consensus_history'), 30, 'no database read over the limit')
})

for (const [name, route, path, table] of [['heatmap', heatmap, '/api/heatmap', 'feedback'], ['rankings', rankings, '/api/leaderboard', 'api_weights']]) {
  test(`${name}: over thirty a minute an address gets the last answer built here, without a database read and not kept`, async () => {
    reset()
    const first = await ask(route, path, '203.0.113.63')
    const body = await first.text()
    for (let i = 1; i < 30; i++) await ask(route, `${path}?x=${i}`, '203.0.113.63')
    assert.equal(reads(table), 30)
    const over = await ask(route, `${path}?x=30`, '203.0.113.63')
    assert.equal(over.status, 200)
    assert.equal(over.headers.get('cache-control'), 'no-store')
    assert.equal(await over.text(), body)
    assert.equal(reads(table), 30, 'no database read over the limit')
  })
}

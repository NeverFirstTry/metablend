// The first-time peaks' shelf reads only the copy the summit pages keep, and never Open-Meteo (owner, 2026-11-22:
// "Change the summit-forecast read for this shelf so it serves only the stored copy and never asks Open-Meteo; if
// no stored copy exists, that peak is left out of the shelf. Test first: a test that fails if this path can reach
// Open-Meteo."). /api/hike?...&stored=only answers from the peak's kept answer of the summit pages' address
// (models=core, lib/last-answer.js) or 404. The route is called for real with every outside call faked
// (lib/test-route-fakes.js): the only request it may send is the database read of that kept answer.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { json, seen, answerWith, reset } from './test-route-fakes.js'

const GLOCKNER = 'lat=47.075&lon=12.694&elev=3798&name=Gro%C3%9Fglockner'
const KEPT = { nowLocal: '2026-11-22T08:00', utcOffsetSec: 3600, generatedAt: '2026-11-22T06:30:00Z', notes: [], hourly: [{ time: '2026-11-22T08:00' }],
  windows: { today: { window: { from: '2026-11-22T09:00', to: '2026-11-22T12:30' }, next: null }, tomorrow: null }, peak: { name: null } }
const row = body => ({ body: gzipSync(JSON.stringify(body)).toString('base64'), made_at: '2026-11-22T06:30:00Z' })

async function ask(kept, query = GLOCKNER) {
  const { GET } = await import('../app/api/hike/route.js')
  reset()
  answerWith(({ url, method }) => {
    if (method === 'GET' && url.includes('/rest/v1/last_answers?')) return json(kept ? [row(kept)] : [])
  })
  const res = await GET(new Request(`https://metablend.app/api/hike?${query}&models=core&stored=only`))
  // everything the route sent that is not the read of the kept answer: Open-Meteo, the weights, a write
  const other = seen.filter(c => !(c.method === 'GET' && c.url.includes('/rest/v1/last_answers?')))
  return { res, body: await res.json(), other, read: seen.find(c => c.url.includes('/rest/v1/last_answers?')) }
}

test('a kept copy: the answer is that copy, and nothing else is asked, Open-Meteo least of all', async () => {
  const { res, body, other, read } = await ask(KEPT)
  assert.equal(res.status, 200)
  assert.deepEqual(other.map(c => c.url), [], 'no request but the kept copy\'s read')
  assert.match(read.url, /kind=eq\.summit/)
  assert.match(read.url, /place=eq\.47\.075,12\.694,3798,core/, 'the summit pages\' copy (models=core)')
  assert.deepEqual(body.windows, KEPT.windows)
  assert.equal(body.nowLocal, KEPT.nowLocal)
  assert.match(res.headers.get('cache-control'), /s-maxage=\d+/)
})

test('no kept copy: 404, and still no request to Open-Meteo', async () => {
  const { res, body, other } = await ask(null)
  assert.equal(res.status, 404)
  assert.equal(body.missing, true)
  assert.deepEqual(other.map(c => c.url), [])
})

test('a peak query without its height is refused before anything is read', async () => {
  const { res, other, read } = await ask(KEPT, 'lat=47.075&lon=12.694')
  assert.equal(res.status, 400)
  assert.deepEqual(other, [])
  assert.equal(read, undefined)
})

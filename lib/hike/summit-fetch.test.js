import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadSummit } from './summit-fetch.js'
import { STORED_SECONDS, KEPT_SECONDS } from './summit-props.js'

const URL = 'https://metablend.app/api/hike?lat=47.075&lon=12.694&elev=3798&name=Gro%C3%9Fglockner'
const forecast = { hourly: [{ t: '2026-11-10T12:00' }], days: [{ date: '2026-11-10' }] }
// a fetch whose answers come from a list, one per call, noting what was asked
function answers(...list) {
  const asked = []
  const get = async (url, opts) => {
    asked.push({ url, opts })
    const [status, body] = list.shift()
    return { ok: status === 200, status, json: async () => body }
  }
  return { get, asked }
}

// the cache keeps the first unavailable answer; the page must not fail while the API answers again (2026-11-10)
test('loadSummit — a kept "unavailable" answer is asked again under its own key, and the page gets the forecast', async () => {
  const { get, asked } = answers([200, { unavailable: true }], [200, forecast])
  assert.deepEqual(await loadSummit(URL, get), forecast)
  assert.equal(asked.length, 2)
  assert.notEqual(asked[1].url, asked[0].url) // a key no kept answer can stand in for
  assert.ok(asked[1].url.startsWith(`${URL}&fresh=`))
  assert.deepEqual(asked[1].opts, { next: { revalidate: STORED_SECONDS } }) // still cacheable: the page stays a cached page
})

test('loadSummit — a good answer is used as it is, asked once', async () => {
  const { get, asked } = answers([200, forecast])
  assert.deepEqual(await loadSummit(URL, get), forecast)
  assert.equal(asked.length, 1)
})

test('loadSummit — still unavailable, or an error, after the second ask: the page fails (500, nothing kept)', async () => {
  await assert.rejects(loadSummit(URL, answers([200, { unavailable: true }], [200, { unavailable: true }]).get), /hike api unavailable/)
  await assert.rejects(loadSummit(URL, answers([200, { unavailable: true }], [502, null]).get), /hike api 502/)
  await assert.rejects(loadSummit(URL, answers([500, null], [500, null]).get), /hike api 500/)
})

// A page is rebuilt at the shortest time among its own requests. During an Open-Meteo outage the route answers
// with the peak's last good answer, marked `kept`; a page built from that must not stay six hours (owner,
// 2026-11-20), so the same address is asked once more under 30 minutes, and that answer is the one used.
const old = { ...forecast, kept: '2026-11-10T09:00:00.000Z' }
test('loadSummit — the last good answer from an outage is asked again under 30 minutes, and the page gets that answer', async () => {
  assert.equal(KEPT_SECONDS, 1800)
  const { get, asked } = answers([200, old], [200, { ...old, again: true }])
  assert.deepEqual(await loadSummit(URL, get), { ...old, again: true })
  assert.deepEqual(asked.map(a => a.url), [URL, URL])
  assert.deepEqual(asked.map(a => a.opts.next.revalidate), [STORED_SECONDS, KEPT_SECONDS])
})

test('loadSummit — the outage is over at the second ask: the page gets the new forecast (and is still built again in 30 minutes)', async () => {
  const { get, asked } = answers([200, old], [200, forecast])
  assert.deepEqual(await loadSummit(URL, get), forecast)
  assert.equal(asked.length, 2)
})

test('loadSummit — the second ask fails or has nothing: the last good answer is used, under the short time all the same', async () => {
  for (const second of [[200, { unavailable: true }], [502, null]]) {
    const { get, asked } = answers([200, old], second)
    assert.deepEqual(await loadSummit(URL, get), old)
    assert.equal(asked[1].opts.next.revalidate, KEPT_SECONDS)
  }
  // and when it cannot be asked at all
  const first = answers([200, old]).get
  let n = 0
  assert.deepEqual(await loadSummit(URL, (u, o) => (n++ ? Promise.reject(new Error('down')) : first(u, o))), old)
})

test('loadSummit — a last good answer that came under the second key is asked again under that key', async () => {
  const { get, asked } = answers([200, { unavailable: true }], [200, old], [200, old])
  assert.deepEqual(await loadSummit(URL, get), old)
  assert.equal(asked[2].url, asked[1].url)
  assert.deepEqual(asked.map(a => a.opts.next.revalidate), [STORED_SECONDS, STORED_SECONDS, KEPT_SECONDS])
})

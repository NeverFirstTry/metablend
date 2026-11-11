import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadSummit } from './summit-fetch.js'

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
  assert.deepEqual(asked[1].opts, { next: { revalidate: 1800 } }) // still cacheable: the page stays a cached page
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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getJson, lastUpstreamFailure } from './http.js'

test('getJson — a refused request is remembered with its status and reason', async () => {
  const real = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('{"error":true,"reason":"Daily API request limit exceeded"}', { status: 429 })
    assert.equal(await getJson('https://api.open-meteo.com/v1/forecast?x=1'), null)
    const f = lastUpstreamFailure()
    assert.equal(f.host, 'api.open-meteo.com')
    assert.equal(f.status, 429)
    assert.match(f.reason, /Daily API request limit/)
    globalThis.fetch = async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }) }
    assert.equal(await getJson('https://api.met.no/x'), null)
    assert.deepEqual([lastUpstreamFailure().host, lastUpstreamFailure().status, lastUpstreamFailure().reason], ['api.met.no', 0, 'TimeoutError'])
  } finally {
    globalThis.fetch = real
  }
})

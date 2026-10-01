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

test('getJson — retries once after a timeout or a server error, never after a 4xx', async () => {
  const real = globalThis.fetch
  let calls = 0
  const timeout = () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }) }
  try {
    calls = 0
    globalThis.fetch = async () => (++calls === 1 ? timeout() : new Response('{"ok":1}'))
    assert.deepEqual(await getJson('https://api.open-meteo.com/a', { retries: 1 }), { ok: 1 })
    assert.equal(calls, 2)
    calls = 0
    globalThis.fetch = async () => (++calls === 1 ? new Response('busy', { status: 503 }) : new Response('{"ok":2}'))
    assert.deepEqual(await getJson('https://api.open-meteo.com/b', { retries: 1 }), { ok: 2 })
    calls = 0
    globalThis.fetch = async () => { calls++; return new Response('bad', { status: 400 }) }
    assert.equal(await getJson('https://api.open-meteo.com/c', { retries: 1 }), null)
    assert.equal(calls, 1)
    calls = 0
    globalThis.fetch = async () => { calls++; return timeout() }
    assert.equal(await getJson('https://api.open-meteo.com/d'), null)
    assert.equal(calls, 1) // no retries unless asked
  } finally {
    globalThis.fetch = real
  }
})

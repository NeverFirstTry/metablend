// The rain nowcast route, called for real with Open-Meteo faked by the recorded Vienna answer: a cold
// instance answers 200 and lets the CDN keep the answer 10 minutes (one Open-Meteo request per place
// per 10 minutes, half of what 5 minutes cost); the same place again is served from the copy.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const vienna = readFileSync(new URL('./__fixtures__/nowcast-vienna.json', import.meta.url), 'utf8')
const calls = { upstream: 0 }
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.includes('api.open-meteo.com/v1/forecast') && url.includes('minutely_15')) { calls.upstream++; return new Response(vienna, { headers: { 'content-type': 'application/json' } }) }
  if (url.includes('proj.supabase.co/rest/v1/')) return new Response('[]', { status: (init?.method ?? 'GET') === 'GET' ? 200 : 201, headers: { 'content-type': 'application/json' } })
  return new Response('not found', { status: 404 })
}
const { GET } = await import('../app/api/nowcast/route.js')
const ask = () => GET(new Request('https://metablend.app/api/nowcast?lat=48.2&lon=16.38', { headers: { 'x-forwarded-for': '203.0.113.9' } }))

test('a cold instance answers the nowcast and the CDN may keep it 10 minutes; the next request is served from the copy', async () => {
  const first = await ask()
  assert.equal(first.status, 200)
  const body = await first.json()
  assert.ok(Array.isArray(body.steps) || typeof body === 'object', 'a nowcast payload')
  assert.match(first.headers.get('cache-control'), /s-maxage=600\b/)
  assert.match(first.headers.get('cache-control'), /stale-while-revalidate=600\b/)
  assert.equal(calls.upstream, 1)
  const second = await ask()
  assert.equal(second.status, 200)
  assert.equal(calls.upstream, 1, 'the copy was served, Open-Meteo was not asked again')
  assert.match(second.headers.get('cache-control'), /s-maxage=(5\d\d|600)\b/)
})

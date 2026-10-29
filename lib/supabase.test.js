import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { supabase, makeClient } = await import('./supabase.js')
const { PRODUCTION_REF } = await import('./db-target.js')

// What every route's database call sends — the same whichever client builds it.
async function capture(run) {
  const real = globalThis.fetch
  let seen
  globalThis.fetch = async (url, init) => { seen = { url: String(url), init }; return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }) }
  try { await run() } finally { globalThis.fetch = real }
  const h = new Headers(seen.init.headers)
  return { url: seen.url, method: seen.init.method, apikey: h.get('apikey'), auth: h.get('authorization'), prefer: h.get('prefer'), body: seen.init.body }
}

test('supabase — selects go to /rest/v1 with the service key, filters in the query', async () => {
  const r = await capture(() => supabase.from('warnings').select('id, level').eq('country', 'DE').gt('level', 2))
  assert.equal(r.url, 'https://proj.supabase.co/rest/v1/warnings?select=id%2Clevel&country=eq.DE&level=gt.2')
  assert.equal(r.method, 'GET')
  assert.equal(r.apikey, 'service-key')
  assert.equal(r.auth, 'Bearer service-key')
})

test('supabase — upserts merge on the conflict column; rpc posts its arguments', async () => {
  const up = await capture(() => supabase.from('warnings').upsert([{ id: 'a' }], { onConflict: 'id' }))
  assert.equal(up.method, 'POST')
  assert.equal(up.url, 'https://proj.supabase.co/rest/v1/warnings?on_conflict=id&columns=%22id%22')
  assert.match(up.prefer, /resolution=merge-duplicates/)
  const rpc = await capture(() => supabase.rpc('do_thing', { n: 1 }))
  assert.equal(rpc.url, 'https://proj.supabase.co/rest/v1/rpc/do_thing')
  assert.equal(rpc.body, '{"n":1}')
})

test('supabase — a local run never writes to the production project: reads pass, writes are refused before any request', async () => {
  const prod = makeClient(`https://${PRODUCTION_REF}.supabase.co`, 'k', {})
  const real = globalThis.fetch
  const sent = []
  globalThis.fetch = async (url, init) => { sent.push(init?.method ?? 'GET'); return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }) }
  try {
    assert.equal((await prod.from('route_cache').select('peak_key')).error, null)
    const up = await prod.from('route_cache').update({ routes: [] }).eq('peak_key', 'x')
    assert.match(up.error?.message ?? '', /production database/)
    assert.match((await prod.rpc('bump_api_stats', { rows: [] })).error?.message ?? '', /production database/)
    assert.deepEqual(sent, ['GET'])
    // the deployed site writes as before
    await makeClient(`https://${PRODUCTION_REF}.supabase.co`, 'k', { VERCEL: '1' }).from('route_cache').update({ routes: [] }).eq('peak_key', 'x')
    assert.deepEqual(sent, ['GET', 'PATCH'])
  } finally { globalThis.fetch = real }
})

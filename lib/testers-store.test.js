import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
const { supabase } = await import('./supabase.js')
const { saveSignup, listTesters, applyAdminAction } = await import('./testers-store.js')

// The REST requests the tester list sends (the real client, fetch captured).
async function capture(run, answer = []) {
  const real = globalThis.fetch, seen = []
  globalThis.fetch = async (url, init) => {
    seen.push({ url: decodeURIComponent(String(url)), method: init.method, prefer: new Headers(init.headers).get('prefer') ?? '', body: init.body ? JSON.parse(init.body) : null })
    const body = typeof answer === 'function' ? answer(seen.length - 1) : answer
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  let result
  try { result = await run() } finally { globalThis.fetch = real }
  return { seen, result }
}
const BASE = 'https://proj.supabase.co/rest/v1/tester_signups'

test('saveSignup — inserts the row; a second sign-up changes nothing, except that a removed tester is new again', async () => {
  const row = { email: 'a@gmail.com', phone_model: 'Pixel 8', country: null, language: 'de' }
  const { seen } = await capture(() => saveSignup(supabase, row, new Date('2026-10-26T16:00:00Z')))
  assert.equal(seen[0].method, 'POST')
  assert.match(seen[0].url, /^https:\/\/proj\.supabase\.co\/rest\/v1\/tester_signups\?on_conflict=email/)
  assert.match(seen[0].prefer, /resolution=ignore-duplicates/)
  assert.deepEqual(seen[0].body, row)
  assert.equal(seen[1].method, 'PATCH')
  assert.equal(seen[1].url, `${BASE}?email=eq.a@gmail.com&status=eq.removed`)
  assert.deepEqual(seen[1].body, { status: 'new', updated_at: '2026-10-26T16:00:00.000Z' })
})

test('listTesters — everyone still in the test (new, added, opted in), oldest first; or just the new ones', async () => {
  const all = await capture(() => listTesters(supabase), [{ email: 'a@gmail.com', status: 'added' }])
  assert.equal(all.seen[0].method, 'GET')
  assert.equal(all.seen[0].url, `${BASE}?select=email,status,created_at&status=in.(new,added,opted_in)&order=created_at.asc,email.asc&offset=0&limit=1000`)
  assert.deepEqual(all.result, [{ email: 'a@gmail.com', status: 'added' }])
  const fresh = await capture(() => listTesters(supabase, { onlyNew: true }))
  assert.equal(fresh.seen[0].url, `${BASE}?select=email,status,created_at&status=eq.new&order=created_at.asc,email.asc&offset=0&limit=1000`)
})

test('listTesters — past Supabase’s 1000-row answers: page by page, nobody cut off', async () => {
  const page = (n, from) => Array.from({ length: n }, (_, i) => ({ email: `t${from + i}@gmail.com`, status: 'added' }))
  const { seen, result } = await capture(() => listTesters(supabase), call => (call === 0 ? page(1000, 0) : page(3, 1000)))
  assert.equal(seen.length, 2)
  assert.match(seen[1].url, /offset=1000&limit=1000$/)
  assert.equal(result.length, 1003)
})

test('applyAdminAction — set a status, delete addresses, delete everyone', async () => {
  const set = await capture(() => applyAdminAction(supabase, { action: 'set-status', status: 'opted_in', emails: ['a@gmail.com', 'b@gmail.com'] }), [{ email: 'a@gmail.com' }])
  assert.equal(set.seen[0].method, 'PATCH')
  assert.equal(set.seen[0].url, `${BASE}?email=in.(a@gmail.com,b@gmail.com)&select=email`)
  assert.equal(set.seen[0].body.status, 'opted_in')
  const del = await capture(() => applyAdminAction(supabase, { action: 'delete', emails: ['a@gmail.com'] }), [{ email: 'a@gmail.com' }])
  assert.equal(del.seen[0].method, 'DELETE')
  assert.equal(del.seen[0].url, `${BASE}?email=in.(a@gmail.com)&select=email`)
  const all = await capture(() => applyAdminAction(supabase, { action: 'delete-all' }), [])
  assert.equal(all.seen[0].method, 'DELETE')
  assert.equal(all.seen[0].url, `${BASE}?email=not.is.null&select=email`)
  assert.deepEqual(all.result, { action: 'delete-all', changed: 0, emails: [] })
})

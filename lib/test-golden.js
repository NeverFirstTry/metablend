// Test helper (not a test): replays a recorded forecast miss through the real /api/forecast route.
// scripts/record-golden.mjs records one live miss: every outside answer (the weather services, the
// geocoder, the database reads) and the clock. replay() answers those recordings to the same URLs with
// the clock pinned, so the route must build the same blend and store the same rows, whatever changed
// in how the fetchers ask. An answer that was not recorded is a 404: a refactor that asks a new URL
// shows up as a missing source, never as a silent pass.
import fs from 'node:fs'
import path from 'node:path'
import { mock } from 'node:test'
import { fileURLToPath } from 'node:url'

export const GOLDEN_DIR = fileURLToPath(new URL('./__fixtures__/golden/', import.meta.url))
const SECRET_PARAMS = ['appid', 'key', 'apikey'] // the services' keys ride in the URL: never in a fixture

// one call's identity: method, the URL with any key or database host made generic, and a request body
export function callKey(url, method = 'GET', body = null) {
  const u = new URL(url)
  if (u.hostname.endsWith('.supabase.co')) u.hostname = 'proj.supabase.co' // its filters may be named key= too
  else for (const p of SECRET_PARAMS) if (u.searchParams.has(p)) u.searchParams.set(p, 'x')
  return `${method} ${u}${method !== 'GET' && body ? ` ${body}` : ''}`
}
// a database write: answered, collected, never replayed from a recording (town_lookup is a read by POST)
export const isWrite = (url, method) => url.includes('/rest/v1/') && method !== 'GET' && !url.includes('/rpc/town_lookup')
export const requestOf = (input, init = {}) => ({ url: String(input?.url ?? input), method: init.method ?? input?.method ?? 'GET', body: init.body == null ? null : String(init.body) })

// the route as a fresh module instance (its in-memory cache and rate limiter start empty)
let loads = 0
export const loadRoute = () => import(new URL('../app/api/forecast/route.js', import.meta.url).href + `?golden=${++loads}`)

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// → { status, payload, stored }: the route's answer and the rows it stored (forecasts, consensus_history)
export async function replay(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  const answers = new Map(manifest.calls.map(c => [c.key, c]))
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://proj.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-key'
  for (const k of manifest.keys) process.env[k] = 'x' // the same services switched on as when recorded
  const writes = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const { url, method, body } = requestOf(input, init)
    if (isWrite(url, method)) {
      writes.push({ key: callKey(url, method), body: body && JSON.parse(body) })
      return url.includes('/rpc/') ? json(url.includes('bump_open_meteo_calls') ? 12 : null) : new Response(null, { status: 201 })
    }
    const rec = answers.get(callKey(url, method, body))
    if (!rec) return new Response('not recorded', { status: 404 })
    return new Response(fs.readFileSync(path.join(dir, rec.file)), { status: rec.status, headers: { 'content-type': rec.contentType } })
  }
  mock.timers.enable({ apis: ['Date'], now: Date.parse(manifest.now) })
  try {
    const { GET } = await loadRoute()
    const res = await GET(new Request(`https://metablend.app/api/forecast?city=${encodeURIComponent(manifest.city)}&lang=${manifest.lang}`, { headers: { 'x-forwarded-for': '203.0.113.9' } }))
    const payload = await res.json()
    const stored = writes.filter(w => /\/rest\/v1\/(forecasts|consensus_history)(\?|$| )/.test(w.key)).map(w => w.body)
    return { status: res.status, payload, stored }
  } finally {
    mock.timers.reset()
    globalThis.fetch = realFetch
  }
}

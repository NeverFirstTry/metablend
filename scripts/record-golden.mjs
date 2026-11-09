// Records one live forecast miss as a golden fixture for lib/forecast-golden.test.js: every outside
// answer of /api/forecast for a city (the weather services, Open-Meteo's geocoder, the database reads),
// the clock, and the blend the replay of those answers gives (lib/test-golden.js). Run it again only
// when the blend is meant to change; the test then compares against the new recording.
//   node --import ./lib/test-jsx-hooks.js scripts/record-golden.mjs [city] [lang]
// --rebaseline keeps the recorded answers and rewrites expected.json from today's code: for a change
// of the blend the owner has accepted (the golden test's diff shows it first).
// Needs .env.local (the dev database and the services' keys). The run stores forecast rows in the
// dev database like any local forecast. Keys never reach a fixture: URLs are recorded with them
// replaced, and every written file is checked for every secret value.
import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from './lib/production.mjs'
import { GOLDEN_DIR, callKey, isWrite, requestOf, loadRoute, replay } from '../lib/test-golden.js'

const env = parseEnv(fs.readFileSync('.env.local', 'utf8'))
for (const [k, v] of Object.entries(env)) process.env[k] ??= v
const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const city = args[0] ?? 'lienz', lang = args[1] ?? 'en'
const dir = path.join(GOLDEN_DIR, `${city}-${lang}`)
if (process.argv.includes('--rebaseline')) {
  const { status, payload, stored } = await replay(dir)
  if (status !== 200) throw new Error(`replay answered ${status}`)
  fs.writeFileSync(path.join(dir, 'expected.json'), JSON.stringify({ payload, stored }, null, 2) + '\n')
  console.log(`${dir}: expected.json rewritten from the replay (${payload.sources.length} sources, consensus ${payload.consensus.temp})`)
  process.exit(0)
}
fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(dir, { recursive: true })

const KEYS = ['OPENWEATHERMAP_API_KEY', 'WEATHERAPI_KEY', 'VISUAL_CROSSING_KEY', 'PIRATE_WEATHER_KEY'].filter(k => process.env[k])
const slug = key => { const u = new URL(key.split(' ')[1]); return (u.hostname.split('.')[0] + u.pathname).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() }

const calls = []
let seq = 0 // the answers arrive in any order: a file number is taken before the first await
const real = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const { url, method, body } = requestOf(input, init)
  const n = seq++
  const res = await real(input, init)
  if (!isWrite(url, method)) {
    const key = callKey(url, method, body)
    const file = `${String(n).padStart(2, '0')}-${slug(key)}.json`
    fs.writeFileSync(path.join(dir, file), await res.clone().text())
    calls.push({ key, status: res.status, contentType: res.headers.get('content-type')?.split(';')[0] ?? 'application/json', file })
  }
  return res
}

const now = new Date().toISOString()
const { GET } = await loadRoute()
const res = await GET(new Request(`https://metablend.app/api/forecast?city=${encodeURIComponent(city)}&lang=${lang}`, { headers: { 'x-forwarded-for': '203.0.113.9' } }))
const live = await res.json()
if (res.status !== 200) throw new Error(`forecast answered ${res.status}: ${JSON.stringify(live).slice(0, 200)}`)
globalThis.fetch = real

fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ city, lang, now, keys: KEYS, calls }, null, 2) + '\n')
const { status, payload, stored } = await replay(dir)
if (status !== 200) throw new Error(`replay answered ${status}`)
fs.writeFileSync(path.join(dir, 'expected.json'), JSON.stringify({ payload, stored }, null, 2) + '\n')

// no secret in any fixture
const secrets = Object.values(env).filter(v => v.length >= 12)
for (const f of fs.readdirSync(dir)) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8')
  const leaked = secrets.find(s => text.includes(s))
  if (leaked) { fs.rmSync(dir, { recursive: true, force: true }); throw new Error(`${f} carries a secret; fixtures removed`) }
}
console.log(`${dir}: ${calls.length} answers, ${payload.sources.length} sources (${payload.sources.filter(s => s.down).length} down), ${stored.length} stored rows; live and replay agree on temp: ${live.consensus.temp === payload.consensus.temp}`)

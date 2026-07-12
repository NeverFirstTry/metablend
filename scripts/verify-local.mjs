// MetaBlend Local verification against an INDEPENDENT ground truth.
//
// Ground truth: Meteostat hourly observations (RapidAPI). Meteostat feeds
// nothing in the current calibration (it's only the /api/cleanup fallback and
// VISUAL_CROSSING_KEY is configured), so it never trained the bias being
// tested here.
//
// Method: every stored forecast row (last 4 days, cities where MetaBlend
// Local produced forecasts) is matched to the Meteostat observation nearest
// its fetched_at (<=45 min). Sources are ranked two ways:
//   1. overall MAE across all matched rows
//   2. PAIRED vs metablend: same city + same snapshot only (the honest test)

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// usage: node scripts/verify-local.mjs (needs .env.local with RAPIDAPI_KEY)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(path.join(ROOT, 'package.json'))
const { createClient } = req('@supabase/supabase-js')

const env = Object.fromEntries(
  fs.readFileSync(ROOT + '/.env.local', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// --- forecasts to score ---
const { data: mbCities } = await supabase
  .from('forecasts').select('city')
  .eq('api_id', 'metablend')
  .gt('fetched_at', new Date(Date.now() - 4 * 864e5).toISOString())
const counts = {}
for (const r of mbCities) counts[r.city] = (counts[r.city] ?? 0) + 1
const cities = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c]) => c)
console.log('Cities under test:', cities.join(', '))

const { data: fx } = await supabase
  .from('forecasts')
  .select('city, lat, lon, api_id, temp, fetched_at')
  .in('city', cities)
  .gt('fetched_at', new Date(Date.now() - 4 * 864e5).toISOString())
  .not('temp', 'is', null)
  .limit(5000)
console.log('Forecast rows:', fx.length)

// --- Meteostat hourly per city (one request each) ---
const spanStart = fx.reduce((m, r) => Math.min(m, Date.parse(r.fetched_at)), Infinity)
const d0 = new Date(spanStart).toISOString().slice(0, 10)
const d1 = new Date().toISOString().slice(0, 10)

const obsByCity = {}
for (const city of cities) {
  const { lat, lon } = fx.find(r => r.city === city)
  const url = `https://meteostat.p.rapidapi.com/point/hourly?lat=${lat}&lon=${lon}&start=${d0}&end=${d1}`
  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'meteostat.p.rapidapi.com' },
  })
  if (!res.ok) { console.log(`  ${city}: Meteostat HTTP ${res.status} — skipped`); continue }
  const json = await res.json()
  const rows = (json.data ?? []).filter(o => typeof o.temp === 'number')
  // Meteostat hourly times are UTC when no tz param is passed
  obsByCity[city] = rows.map(o => ({ t: Date.parse(o.time.replace(' ', 'T') + 'Z'), temp: o.temp }))
  console.log(`  ${city}: ${rows.length} hourly observations`)
}

// --- match + score ---
const MAX_GAP = 45 * 60e3
const scored = [] // { city, snap, api, err }
for (const r of fx) {
  const obs = obsByCity[r.city]
  if (!obs?.length) continue
  const t = Date.parse(r.fetched_at)
  let best = null
  for (const o of obs) {
    const gap = Math.abs(o.t - t)
    if (gap <= MAX_GAP && (!best || gap < best.gap)) best = { gap, temp: o.temp }
  }
  if (!best) continue
  scored.push({ city: r.city, snap: `${r.city}|${Math.round(t / 36e5)}`, api: r.api_id, err: Math.abs(r.temp - best.temp) })
}
console.log('Scored rows (matched to an observation):', scored.length, '\n')

// 1. overall MAE
const agg = {}
for (const s of scored) {
  agg[s.api] ??= { sum: 0, n: 0 }
  agg[s.api].sum += s.err; agg[s.api].n++
}
console.log('=== Overall MAE vs Meteostat (°C) ===')
Object.entries(agg)
  .map(([api, a]) => ({ api, mae: a.sum / a.n, n: a.n }))
  .sort((a, b) => a.mae - b.mae)
  .forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.api.padEnd(22)} MAE ${r.mae.toFixed(2)}  (n=${r.n})`))

// 2. paired vs metablend (same city, same snapshot hour)
const bySnap = {}
for (const s of scored) (bySnap[s.snap] ??= {})[s.api] = s.err
const paired = {}
for (const snap of Object.values(bySnap)) {
  const mb = snap.metablend
  if (mb == null) continue
  for (const [api, err] of Object.entries(snap)) {
    if (api === 'metablend') continue
    paired[api] ??= { mbSum: 0, apiSum: 0, n: 0, mbWins: 0, ties: 0 }
    const p = paired[api]
    p.mbSum += mb; p.apiSum += err; p.n++
    if (mb < err - 1e-9) p.mbWins++
    else if (Math.abs(mb - err) <= 1e-9) p.ties++
  }
}
console.log('\n=== PAIRED: MetaBlend Local vs each source (same city + snapshot) ===')
Object.entries(paired)
  .map(([api, p]) => ({ api, ...p, mbMae: p.mbSum / p.n, apiMae: p.apiSum / p.n }))
  .sort((a, b) => (a.apiMae - a.mbMae) - (b.apiMae - b.mbMae))
  .forEach(p => {
    const edge = p.apiMae - p.mbMae
    console.log(`vs ${p.api.padEnd(22)} n=${String(p.n).padStart(3)}  MB ${p.mbMae.toFixed(2)} | ${p.apiMae.toFixed(2)}  edge ${edge >= 0 ? '+' : ''}${edge.toFixed(2)}°C  MB wins ${p.mbWins}/${p.n - p.ties}`)
  })
console.log('\n(edge > 0 means MetaBlend Local was closer to the independent observation)')

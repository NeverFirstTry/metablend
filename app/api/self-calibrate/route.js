import { supabase } from '@/lib/supabase'
import { median, deltaFromDiff } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { localDateForLon } from '@/lib/weather'
import {
  fetchOpenMeteo, fetchOWM, fetchWeatherAPI, fetchTomorrow, fetchMETNorway,
  fetchVisualCrossing, fetchWorldWeatherOnline, fetchWeatherStack, fetchNASAPOWER,
  fetchECMWF, fetchGFS, fetchICON, fetchNWS, fetchBrightSky, fetchSMHI,
} from '@/lib/weather'

// Admin-only: rebalances API weights immediately by scoring every source
// against the live multi-source median across a basket of cities (the "instant"
// consensus pass), and seeds today's forecasts so the ground-truth cron
// (/api/calibrate, /api/cleanup) can refine those weights against real actuals
// over the next day. Trigger it from a terminal with the shared secret (header):
//   curl -H "x-calibrate-key: $CALIBRATE_SECRET" http://localhost:3000/api/self-calibrate
// or from the leaderboard "Recalibrate" button (which prompts for the key).

const FETCHERS = {
  'open-meteo': fetchOpenMeteo,
  owm: fetchOWM,
  weatherapi: fetchWeatherAPI,
  tomorrow: fetchTomorrow,
  'met-norway': fetchMETNorway,
  'visual-crossing': fetchVisualCrossing,
  'world-weather-online': fetchWorldWeatherOnline,
  weatherstack: fetchWeatherStack,
  'nasa-power': fetchNASAPOWER,
  // keyless model feeds + regional sources (regionals return null outside coverage)
  ecmwf: fetchECMWF,
  gfs: fetchGFS,
  icon: fetchICON,
  nws: fetchNWS,
  brightsky: fetchBrightSky,
  smhi: fetchSMHI,
}

// Fixed reference basket (region pre-tagged so we skip geocoding). Spread across
// every region so each region's weights get samples in one run.
const CITIES = [
  { name: 'London',        lat: 51.51, lon: -0.13,   region: 'europe' },
  { name: 'Berlin',        lat: 52.52, lon: 13.40,   region: 'europe' },
  { name: 'Madrid',        lat: 40.42, lon: -3.70,   region: 'europe' },
  { name: 'New York',      lat: 40.71, lon: -74.01,  region: 'north_america' },
  { name: 'Chicago',       lat: 41.88, lon: -87.63,  region: 'north_america' },
  { name: 'Mexico City',   lat: 19.43, lon: -99.13,  region: 'north_america' },
  { name: 'Sao Paulo',     lat: -23.55, lon: -46.63, region: 'south_america' },
  { name: 'Buenos Aires',  lat: -34.61, lon: -58.38, region: 'south_america' },
  { name: 'Tokyo',         lat: 35.68, lon: 139.65,  region: 'asia' },
  { name: 'Mumbai',        lat: 19.08, lon: 72.88,   region: 'asia' },
  { name: 'Singapore',     lat: 1.35,  lon: 103.82,  region: 'asia' },
  { name: 'Cairo',         lat: 30.04, lon: 31.24,   region: 'africa' },
  { name: 'Lagos',         lat: 6.52,  lon: 3.38,    region: 'africa' },
  { name: 'Nairobi',       lat: -1.29, lon: 36.82,   region: 'africa' },
  { name: 'Sydney',        lat: -33.87, lon: 151.21, region: 'oceania' },
  { name: 'Auckland',      lat: -36.85, lon: 174.76, region: 'oceania' },
]

// The whole basket is fetched live and every source scored — give it room.
export const maxDuration = 60

const MIN_SOURCES_PER_CITY = 3 // need a real spread before a median means anything

// Pull every source for one point, in parallel. Null (no key) and throws
// (down/timeout) both just drop out.
async function fetchCity(lat, lon) {
  const ids = Object.keys(FETCHERS)
  const settled = await Promise.all(ids.map(async id => {
    try {
      const v = await FETCHERS[id](lat, lon)
      return v && typeof v.temp === 'number' ? v : null
    } catch {
      return null
    }
  }))
  return settled.filter(Boolean)
}

async function handle(request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.CALIBRATE_SECRET
  if (!secret) {
    return Response.json({ error: 'CALIBRATE_SECRET is not configured on the server.' }, { status: 503 })
  }
  // Header-only — a query param would end up in access/proxy logs.
  const provided =
    request.headers.get('x-calibrate-key') ??
    (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (provided !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Does this DB have the per-region weights migration? Decides whether we
  // calibrate every region or just a single global bucket.
  const { error: regionProbe } = await supabase.from('api_weights').select('region').limit(1)
  const hasRegionCol = !regionProbe

  // forecasts.api_id has a FK to the reference table — only seed rows for APIs
  // that actually exist there, or an atomic batch insert fails entirely.
  const { data: knownRows } = await supabase.from('api_weights').select('id')
  const knownIds = new Set((knownRows ?? []).map(r => r.id))

  const today = new Date().toISOString().split('T')[0]

  // ── 1. Fetch the whole basket live (cities in parallel) ──────────────────
  const fetched = await Promise.all(
    CITIES.map(async c => ({ city: c, results: await fetchCity(c.lat, c.lon) }))
  )

  // ── 2. Score each source vs the live median + collect forecast rows ──────
  const perBucket = {}           // bucket -> { apiId: [delta, ...] }
  const addDelta = (bucket, id, delta) => {
    ;(perBucket[bucket] ??= {})
    ;(perBucket[bucket][id] ??= []).push(delta)
  }
  const forecastRows = []
  let citiesScored = 0
  let sourcesSeen = 0

  for (const { city, results } of fetched) {
    sourcesSeen += results.length

    // seed forecasts for the ground-truth cron regardless of source count
    for (const r of results) {
      if (!knownIds.has(r.apiId)) continue // skip sources not in the FK reference table
      forecastRows.push({
        city: city.name, lat: city.lat, lon: city.lon,
        api_id: r.apiId, valid_for: localDateForLon(city.lon),
        temp: r.temp, rain_pct: r.rainPct, wind_kmh: r.windKmh,
        condition: r.condition, region: city.region,
      })
    }

    if (results.length < MIN_SOURCES_PER_CITY) continue
    citiesScored++

    const med = median(results.map(r => r.temp))
    for (const r of results) {
      const delta = deltaFromDiff(Math.abs(r.temp - med), 'instant')
      addDelta('global', r.apiId, delta)            // global always accumulates
      if (hasRegionCol) addDelta(city.region, r.apiId, delta)
    }
  }

  // ── 3. Seed forecasts (best-effort; retry without region on old schema) ──
  let seeded = 0
  let seedError = null
  if (forecastRows.length) {
    let { error: insErr } = await supabase.from('forecasts').insert(forecastRows)
    if (insErr) {
      const minimal = forecastRows.map(({ region, ...r }) => r)
      ;({ error: insErr } = await supabase.from('forecasts').insert(minimal))
    }
    if (insErr) seedError = insErr.message
    else seeded = forecastRows.length
  }

  // ── 4. Apply the instant consensus rebalance per bucket ──────────────────
  // (shared pipeline in lib/weights.js — same normalization as the feedback
  // route, so the ground-truth cron continues from the same baseline)
  const rebalanced = {}
  for (const bucket of Object.keys(perBucket)) {
    const applied = await applyDeltas(bucket, perBucket[bucket])
    if (applied) {
      rebalanced[bucket] = applied
        .map(u => ({ id: u.id, weight: +(u.weight * 100).toFixed(1), samples: u.deltas.length }))
        .sort((a, b) => b.weight - a.weight)
    }
  }

  return Response.json({
    ok: true,
    date: today,
    mode: hasRegionCol ? 'per-region' : 'global-only',
    citiesProbed: CITIES.length,
    citiesScored,
    sourcesSeen,
    forecastsSeeded: seeded,
    ...(seedError ? { seedError } : {}),
    rebalanced,
    note: 'Weights rebalanced against the live consensus now; the daily cron will refine them against real actuals.',
  })
}

export const GET = handle
export const POST = handle

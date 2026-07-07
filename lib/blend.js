// MetaBlend Local — the app's own prognostic source. It serves the live
// consensus corrected by a learned per-city temperature bias, where the bias
// is an exponential moving average of (ground truth − consensus) collected
// from user feedback and hourly METAR station calibration.
//
// v2: the bias is learned in separate day and night buckets, because consensus
// errors are usually asymmetric (models routinely miss nighttime cooling).
//
// The synthetic source is deliberately NOT part of the consensus it derives
// from (that would be circular). It is stored in `forecasts` and scored by the
// daily calibration like any other source, so the leaderboard shows whether
// consensus + local correction actually beats the raw APIs.

import { supabase } from './supabase.js'
import { emaBias } from './scoring.js'

const MIN_SAMPLES = 3    // don't serve a correction until there's real signal
const MAX_ERROR = 15     // a report this far off is junk, not signal

// Night = 21:00–06:00 city-local, estimated from the longitude (15° ≈ 1 h) —
// the same convention the feedback route's sunny-at-night guard uses.
export function isNightAt(lon, now = new Date()) {
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60
  const local = (((utcHour + (typeof lon === 'number' ? lon / 15 : 0)) % 24) + 24) % 24
  return local >= 21 || local < 6
}

// Learned bias for a city at the given time of day, or null while there isn't
// enough signal. Prefers the matching bucket; when only the other bucket has
// data, falls back to the samples-weighted blend of both.
export async function getCityBias(city, night = false) {
  try {
    const { data } = await supabase
      .from('city_bias')
      .select('temp_bias, samples, temp_bias_night, samples_night')
      .ilike('city', city)
      .limit(1)
    const r = data?.[0]
    if (!r) return null
    const day = { bias: r.temp_bias ?? 0, n: r.samples ?? 0 }
    const nt  = { bias: r.temp_bias_night ?? 0, n: r.samples_night ?? 0 }
    const want = night ? nt : day
    if (want.n >= MIN_SAMPLES) return want.bias
    const total = day.n + nt.n
    if (total >= MIN_SAMPLES) {
      return Math.round(((day.bias * day.n + nt.bias * nt.n) / total) * 100) / 100
    }
    return null
  } catch {
    return null // table/columns may not exist yet
  }
}

// Feed one observation of (actual − consensus) into the city's bias bucket.
export async function updateCityBias(city, lat, lon, region, error, night = isNightAt(lon)) {
  if (!city || typeof error !== 'number' || !Number.isFinite(error)) return
  if (Math.abs(error) > MAX_ERROR) return
  try {
    const { data } = await supabase
      .from('city_bias')
      .select('city, temp_bias, samples, temp_bias_night, samples_night')
      .ilike('city', city)
      .limit(1)
    const cur = data?.[0]
    const row = {
      city: cur?.city ?? city, // keep the existing row's casing
      lat, lon,
      region: region ?? 'global',
      temp_bias: cur?.temp_bias ?? 0,
      samples: cur?.samples ?? 0,
      temp_bias_night: cur?.temp_bias_night ?? 0,
      samples_night: cur?.samples_night ?? 0,
      updated_at: new Date().toISOString(),
    }
    if (night) {
      row.temp_bias_night = emaBias(row.temp_bias_night, error)
      row.samples_night += 1
    } else {
      row.temp_bias = emaBias(row.temp_bias, error)
      row.samples += 1
    }
    await supabase.from('city_bias').upsert(row, { onConflict: 'city' })
  } catch {
    // best-effort: a missing table must never break feedback/calibration
  }
}

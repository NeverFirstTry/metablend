// MetaBlend Local — the app's own prognostic source. It serves the live
// consensus corrected by a learned per-city temperature bias, where the bias
// is an exponential moving average of (ground truth − consensus) collected
// from user feedback and hourly PWS station calibration.
//
// The synthetic source is deliberately NOT part of the consensus it derives
// from (that would be circular). It is stored in `forecasts` and scored by the
// daily calibration like any other source, so the leaderboard shows whether
// consensus + local correction actually beats the raw APIs.

import { supabase } from './supabase.js'

const ALPHA = 0.2        // EMA step: recent errors dominate, old ones fade
const MIN_SAMPLES = 3    // don't serve a correction until there's real signal
const MAX_ERROR = 15     // a report this far off is junk, not signal

// Learned bias for a city, or null while there aren't enough samples yet.
export async function getCityBias(city) {
  try {
    const { data } = await supabase
      .from('city_bias')
      .select('temp_bias, samples')
      .ilike('city', city)
      .limit(1)
    const row = data?.[0]
    if (!row || row.samples < MIN_SAMPLES) return null
    return row.temp_bias
  } catch {
    return null // table may not exist yet
  }
}

// Feed one observation of (actual − consensus) into the city's bias.
export async function updateCityBias(city, lat, lon, region, error) {
  if (!city || typeof error !== 'number' || !Number.isFinite(error)) return
  if (Math.abs(error) > MAX_ERROR) return
  try {
    const { data } = await supabase
      .from('city_bias')
      .select('city, temp_bias, samples')
      .ilike('city', city)
      .limit(1)
    const cur = data?.[0]
    const bias = cur ? cur.temp_bias * (1 - ALPHA) + error * ALPHA : error * ALPHA
    await supabase.from('city_bias').upsert({
      city: cur?.city ?? city, // keep the existing row's casing
      lat, lon,
      region: region ?? 'global',
      temp_bias: Math.round(bias * 100) / 100,
      samples: (cur?.samples ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'city' })
  } catch {
    // best-effort: a missing table must never break feedback/calibration
  }
}

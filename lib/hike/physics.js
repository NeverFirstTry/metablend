// Summit physics (pure — unit tested): wind at the summit's height, the
// freezing level, and the hourly thunderstorm risk.

// Standard-atmosphere heights of the requested pressure levels (500 / 300 hPa
// so the world's highest peaks don't get mid-level wind).
const LEVELS = [['w850', 1500], ['w700', 3000], ['w600', 4200], ['w500', 5600], ['w300', 9200]]
const LAPSE = 0.0065 // °C per metre
const r1 = v => Math.round(v * 10) / 10

// 10 m model wind sits on smoothed terrain and understates ridge wind, so
// from 1500 m up the summit wind comes from the pressure levels bracketing
// the summit, linearly interpolated. A missing level falls back to the
// nearest one reported; a model with no level at all sits the vote out.
export function summitWind(elev, p) {
  if (elev < 1500) return p.wind10 ?? p.w850 ?? null
  const have = LEVELS.filter(([k]) => typeof p[k] === 'number')
  if (!have.length) return null
  const below = [...have].reverse().find(([, z]) => z <= elev)
  const above = have.find(([, z]) => z >= elev)
  if (below && above && below[1] !== above[1]) {
    const f = (elev - below[1]) / (above[1] - below[1])
    return r1(p[below[0]] + (p[above[0]] - p[below[0]]) * f)
  }
  return p[(below ?? above)[0]]
}

// The model's freezing level where it publishes one (GFS, ICON), otherwise
// worked out from the summit temperature with the standard lapse rate.
export function freezingLevel(p, elev) {
  const round10 = v => Math.max(0, Math.round(v / 10) * 10)
  if (typeof p.fl === 'number') return round10(p.fl)
  if (typeof p.temp !== 'number') return null
  return round10(elev + p.temp / LAPSE)
}

// Starting thresholds (spec §3.2) — one table, tuned later against real days.
export const STORM = { highCape: 1000, highPop: 30, modCape: 300, modPop: 20, lpiHigh: 1 }

// 'low' | 'moderate' | 'high', or null when no model reported storm energy.
export function stormRisk({ cape, pop, lpi }) {
  if (typeof lpi === 'number' && lpi >= STORM.lpiHigh) return 'high'
  if (typeof cape !== 'number') return null
  const rain = pop ?? 0
  if (cape >= STORM.highCape && rain >= STORM.highPop) return 'high'
  if (cape >= STORM.modCape && rain >= STORM.modPop) return 'moderate'
  return 'low'
}

// What falls at a height: the temperature there decides. A model's weather word and code are for its own grid
// height, in the mountains often the valley's (2026-11-26: "Rain from 08:00" at -12 degrees on the Schneeberg,
// 2076 m). Below freezing it is snow, from freezing to 2 degrees above it rain and snow mixed, warmer rain.
// Without a temperature the word stays rain, as before.
// The rule goes by the whole degrees the screen shows (owner, 2026-11-28: "Go by the rounded temperature that is
// shown on screen, everywhere the rule applies"): -0.4 reads "0°" and is mixed, never snow beside a zero. Shown -1
// or lower snow, 0 or 1 mixed, 2 or higher rain. Math.round is the screen's own rounding (-0.5 shows as 0).
export const PRECIP = { snowBelowC: 0, mixedBelowC: 2 }
const byDegrees = t => (t < PRECIP.snowBelowC ? 'snow' : t < PRECIP.mixedBelowC ? 'mixed' : 'rain')
export const precipKind = temp => (typeof temp !== 'number' ? 'rain' : byDegrees(Math.round(temp)))
// a day shows its low and its high: the rule takes the middle of those two whole numbers
export const precipKindOfDay = (low, high) => byDegrees((Math.round(low) + Math.round(high)) / 2)

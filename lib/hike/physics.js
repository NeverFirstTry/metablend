// Summit physics (pure — unit tested): wind at the summit's height, the
// freezing level, and the hourly thunderstorm risk.

// Standard-atmosphere heights of the requested pressure levels.
const LEVELS = [['w850', 1500], ['w700', 3000], ['w600', 4200]]
const LAPSE = 0.0065 // °C per metre
const r1 = v => Math.round(v * 10) / 10

// 10 m model wind sits on smoothed terrain and understates ridge wind, so
// from 1500 m up the summit wind comes from the pressure levels bracketing
// the summit, linearly interpolated. A missing level falls back to the
// nearest one reported, then to the 10 m wind.
export function summitWind(elev, p) {
  if (elev < 1500) return p.wind10 ?? p.w850 ?? null
  const have = LEVELS.filter(([k]) => typeof p[k] === 'number')
  if (!have.length) return p.wind10 ?? null
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

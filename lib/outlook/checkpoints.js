// Which predictions of a source get saved for later checking (pure — unit
// tested). Hourly checkpoints are stored as UTC instants so verification never
// has to think about timezones; daily ones as the city-local date.

import { rainProb } from './blend.js'
import { addDays } from '../localtime.js'

export const HOURLY_LEADS = [6, 12, 24, 48]
export const DAILY_LEADS = 14
const SLOT_MS = 6 * 3600e3

// Snapshot slots: one h-snapshot per 6 h (models refresh ~6-hourly), one
// d-snapshot per city-local day (daily predictions move slowly).
export const hourlySlot = ms => Math.floor(ms / SLOT_MS)
export const dailySlot = date => Number(date.replaceAll('-', ''))

export function hourlyCheckpoints(series, { issuedAtMs, utcOffsetSec }) {
  const base = Math.ceil(issuedAtMs / 3600e3) * 3600e3
  const byT = new Map((series.hourly ?? []).map(p => [p.t, p]))
  const out = []
  for (const lead of HOURLY_LEADS) {
    const targetMs = base + lead * 3600e3
    const p = byT.get(new Date(targetMs + utcOffsetSec * 1000).toISOString().slice(0, 16))
    if (p) out.push({ key: `h${lead}`, t: new Date(targetMs).toISOString(), lead, temp: p.temp, rain: rainProb(p.pop, p.precip, 0.1) })
  }
  return out
}

export function dailyCheckpoints(series, { todayLocal }) {
  const byDate = new Map((series.daily ?? []).map(d => [d.date, d]))
  const out = []
  for (let lead = 1; lead <= DAILY_LEADS; lead++) {
    const date = addDays(todayLocal, lead)
    const d = byDate.get(date)
    if (d) out.push({ key: `d${lead}`, date, lead, max: d.max, min: d.min, rain: rainProb(d.pop, d.precip, 1) })
  }
  return out
}

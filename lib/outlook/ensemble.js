// Week-2 uncertainty from the ECMWF (51 members) and NOAA GEFS (31 members)
// ensembles (pure — unit tested). Beyond ~10 days only two deterministic
// models remain, so their disagreement alone would understate the spread;
// the members' p10–p90 is the honest band.

import { percentile } from './blend.js'

const r1 = v => Math.round(v * 10) / 10

export function parseEnsemble(json) {
  const d = json?.daily
  if (!Array.isArray(d?.time)) return null
  const keys = Object.keys(d)
  const gather = prefix => {
    const cols = keys.filter(k => k.startsWith(`${prefix}_`))
    return d.time.map((_, i) => cols.map(k => d[k]?.[i]).filter(v => typeof v === 'number' && Number.isFinite(v)))
  }
  return { dates: d.time, max: gather('temperature_2m_max'), min: gather('temperature_2m_min'), precip: gather('precipitation_sum') }
}

export function ensembleDay(ens, date, minMembers = 10) {
  const i = ens?.dates?.indexOf(date) ?? -1
  if (i < 0) return null
  const mx = [...ens.max[i]].sort((a, b) => a - b)
  const mn = [...ens.min[i]].sort((a, b) => a - b)
  if (mx.length < minMembers || mn.length < minMembers) return null
  const pr = ens.precip[i]
  return {
    maxLo: r1(percentile(mx, 0.1)), maxHi: r1(percentile(mx, 0.9)),
    minLo: r1(percentile(mn, 0.1)), minHi: r1(percentile(mn, 0.9)),
    wetShare: pr.length ? Math.round((pr.filter(v => v >= 1).length / pr.length) * 100) : null,
    members: mx.length,
  }
}

// Week-2 days take their bands (and rain chance) from the members; the
// central high/low stay the learned-weight blend of the deterministic models.
export function applyEnsemble(days, ens, fromLead = 8) {
  return days.map(d => {
    if (d.lead < fromLead) return d
    const e = ensembleDay(ens, d.date)
    if (!e) return d
    return { ...d, maxLo: e.maxLo, maxHi: e.maxHi, minLo: e.minLo, minHi: e.minHi, rainPct: e.wetShare ?? d.rainPct, members: e.members }
  })
}

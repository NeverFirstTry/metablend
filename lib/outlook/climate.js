// Climate reference from 10 years of daily history (pure — unit tested):
// per-date normals and rainy-day counts.

const r1 = v => Math.round(v * 10) / 10
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

// 'MM-DD' → 1..365 on a non-leap calendar (Feb 29 shares Feb 28's slot).
export function dayOfYear(mmdd) {
  const [m, d] = mmdd.split('-').map(Number)
  return CUM[m - 1] + (m === 2 ? Math.min(d, 28) : d)
}
const doyDist = (a, b) => { const x = Math.abs(a - b); return Math.min(x, 365 - x) }

export function indexArchive(json) {
  const d = json?.daily
  if (!Array.isArray(d?.time)) return null
  const rows = []
  d.time.forEach((date, i) => {
    const max = d.temperature_2m_max?.[i], min = d.temperature_2m_min?.[i]
    if (typeof max !== 'number' || typeof min !== 'number') return
    const p = d.precipitation_sum?.[i]
    rows.push({ date, year: date.slice(0, 4), doy: dayOfYear(date.slice(5)), max, min, precip: typeof p === 'number' ? p : null })
  })
  return rows.length ? rows : null
}

// Normal high/low per target date: the mean over every archive day within
// ±window days of the same calendar date (wrapping over New Year).
export function normalsFor(rows, dates, window = 7) {
  return dates.map(date => {
    const t = dayOfYear(date.slice(5))
    let mx = 0, mn = 0, n = 0
    for (const r of rows) if (doyDist(r.doy, t) <= window) { mx += r.max; mn += r.min; n++ }
    return n ? { date, max: r1(mx / n), min: r1(mn / n) } : { date, max: null, min: null }
  })
}

// How many of these calendar days were rainy (≥ 1 mm) in an average year.
export function rainyDaysNormal(rows, dates) {
  const want = new Set(dates.map(d => dayOfYear(d.slice(5))))
  const years = new Set()
  let wet = 0
  for (const r of rows) {
    if (!want.has(r.doy)) continue
    years.add(r.year)
    if (r.precip != null && r.precip >= 1) wet++
  }
  return years.size ? Math.round(wet / years.size) : null
}

// Mean anomaly of this week's daily highs (days 0–6) vs normal.
export function anomalies(days, normals) {
  const normal = new Map((normals ?? []).map(n => [n.date, n.max]))
  const diffs = (days ?? []).slice(0, 7)
    .map(d => (normal.get(d.date) == null || d.tempMax == null ? null : d.tempMax - normal.get(d.date)))
    .filter(v => v != null)
  return { week1: diffs.length ? r1(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null }
}

// The same reference small enough to keep per place for a year (lib/climate-store.js), built once from
// the 10-year archive answer: for each calendar day the normal high and low (tenths of a degree, what
// normalsFor gives for that date) and how many archive days of it were rainy, and for the planner each
// month's mean temperature and rainy days, and the height the archive answered for (a place without a
// table may borrow one from a neighbour at a similar height). About 4 KB.
export const TABLE_VERSION = 2 // 2: with the height
export function climateTable(json) {
  const rows = indexArchive(json)
  if (!rows) return null
  const dates = []
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(Date.UTC(2001, m, 0)).getUTCDate(); d++) dates.push(`2001-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  const normals = normalsFor(rows, dates)
  const wet = Array(365).fill(0)
  for (const r of rows) if (r.precip != null && r.precip >= 1) wet[r.doy - 1]++
  // the planner's months: mean temperature and rainy days (1 mm and more) in an average year
  const d = json.daily, tSum = Array(12).fill(0), tN = Array(12).fill(0), rainy = Array(12).fill(0), yearsOf = Array.from({ length: 12 }, () => new Set())
  d.time.forEach((date, i) => {
    const m = Number(date.slice(5, 7)) - 1
    yearsOf[m].add(date.slice(0, 4))
    const t = d.temperature_2m_mean?.[i], p = d.precipitation_sum?.[i]
    if (t != null) { tSum[m] += t; tN[m]++ }
    if (p != null && p >= 1) rainy[m]++
  })
  return {
    v: TABLE_VERSION,
    elev: typeof json.elevation === 'number' ? Math.round(json.elevation) : null,
    years: new Set(rows.map(r => r.year)).size,
    max: normals.map(n => (n.max == null ? null : Math.round(n.max * 10))),
    min: normals.map(n => (n.min == null ? null : Math.round(n.min * 10))),
    wet,
    months: Array.from({ length: 12 }, (_, m) => ({ month: m + 1, avgTemp: tN[m] ? r1(tSum[m] / tN[m]) : null, avgRainDays: yearsOf[m].size ? Math.round(rainy[m] / yearsOf[m].size) : null })),
  }
}

// normalsFor and rainyDaysNormal, read from the table
export const tableNormals = (table, dates) => dates.map(date => {
  const i = dayOfYear(date.slice(5)) - 1, mx = table.max[i], mn = table.min[i]
  return { date, max: mx == null ? null : mx / 10, min: mn == null ? null : mn / 10 }
})
export function tableRainyDays(table, dates) {
  if (!table.years) return null
  let wet = 0
  for (const doy of new Set(dates.map(d => dayOfYear(d.slice(5))))) wet += table.wet[doy - 1] ?? 0
  return Math.round(wet / table.years)
}

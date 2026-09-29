// Climate reference from 10 years of daily history (pure — unit tested):
// per-date normals, rainy-day counts and this month's records.

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

// Hottest day, coldest night and wettest day of this calendar month.
export function monthRecords(rows, month) {
  let hottest = null, coldest = null, wettest = null
  for (const r of rows) {
    if (Number(r.date.slice(5, 7)) !== month) continue
    if (!hottest || r.max > hottest.temp) hottest = { temp: r.max, date: r.date }
    if (!coldest || r.min < coldest.temp) coldest = { temp: r.min, date: r.date }
    if (r.precip != null && (!wettest || r.precip > wettest.mm)) wettest = { mm: Math.round(r.precip), date: r.date }
  }
  return hottest ? { hottest, coldest, wettest } : null
}

// Mean anomaly of the daily high vs normal: week 1 (days 0–6), week 2 (7–13).
export function anomalies(days, normals) {
  const normal = new Map((normals ?? []).map(n => [n.date, n.max]))
  const week = (from, to) => {
    const diffs = (days ?? []).slice(from, to)
      .map(d => (normal.get(d.date) == null || d.tempMax == null ? null : d.tempMax - normal.get(d.date)))
      .filter(v => v != null)
    return diffs.length ? r1(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null
  }
  return { week1: week(0, 7), week2: week(7, 14) }
}

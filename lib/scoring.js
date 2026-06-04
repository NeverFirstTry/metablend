// Shared weight-scoring math, used by the feedback, calibrate, cleanup and
// self-calibrate routes so the algorithm lives in exactly one place.

export function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Reward/penalty buckets for how far a source's temp was from the truth.
//  • 'instant' — compared against an instantaneous reading (user feedback or
//    the live consensus median): tighter thresholds (1/2/4/6 °C).
//  • 'daily'   — compared against a 24-hour mean (Meteostat validation):
//    looser thresholds (2/4/6/8 °C) since we're matching a point to an average.
const SCHEMES = {
  instant: [1, 2, 4, 6],
  daily:   [2, 4, 6, 8],
}

export function deltaFromDiff(diff, scheme = 'instant') {
  const [a, b, c, d] = SCHEMES[scheme] ?? SCHEMES.instant
  return diff <= a ? +2 : diff <= b ? +1 : diff <= c ? 0 : diff <= d ? -1 : -2
}

// Unnormalized weight factor. Uses the median of recent deltas when history is
// available (robust to outliers), otherwise the running mean score/reports.
// Floored at 0.05 so a bad source still keeps a sliver of weight.
export function rawFactor(score, reports, history) {
  const f = Array.isArray(history) && history.length
    ? median(history)
    : (reports > 0 ? score / reports : 0)
  return Math.max(0.05, 1 + f * 0.3)
}

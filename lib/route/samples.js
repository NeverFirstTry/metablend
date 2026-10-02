// Where along a route to check the weather (pure — unit tested): the start,
// the end, the highest point, and a point every ~1.5 km or 300 m of climb,
// whichever comes first — 6 to 10 points (fewer on very short routes).
import { cumulative, highestIndex } from './geometry.js'

export function pickSamples(points, { everyM = 1500, everyUpM = 300, min = 6, max = 10 } = {}) {
  const n = points.length
  if (n < 2) return n ? [0] : []
  const dist = cumulative(points), hi = highestIndex(points)
  const picks = new Set([0, n - 1, hi])
  let lastD = 0, up = 0
  for (let i = 1; i < n - 1; i++) {
    const dz = (points[i].ele ?? 0) - (points[i - 1].ele ?? 0)
    if (dz > 0) up += dz
    if (dist[i] - lastD >= everyM || up >= everyUpM) { picks.add(i); lastD = dist[i]; up = 0 }
  }
  // too few: split the widest gap until there are enough
  const want = Math.min(min, n)
  while (picks.size < want) {
    const s = [...picks].sort((a, b) => a - b)
    let at = 0
    for (let k = 1; k < s.length - 1; k++) if (s[k + 1] - s[k] > s[at + 1] - s[at]) at = k
    if (s[at + 1] - s[at] < 2) break
    picks.add(Math.floor((s[at] + s[at + 1]) / 2))
  }
  let idx = [...picks].sort((a, b) => a - b)
  // too many: keep start, end and the top, spread the rest evenly
  if (idx.length > max) {
    const must = new Set([0, n - 1, hi])
    const rest = idx.filter(i => !must.has(i)), room = max - must.size
    const chosen = Array.from({ length: room }, (_, k) => rest[Math.floor((k * rest.length) / room)])
    idx = [...new Set([...must, ...chosen])].sort((a, b) => a - b)
  }
  return idx
}

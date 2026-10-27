// Route geometry (pure — unit tested): distances, climb with a hysteresis
// against GPS noise, and simplification that keeps the shape, the ends and
// the highest point. A point is { lat, lon, ele } (ele may be null).
const R = 6371008.8
const rad = d => (d * Math.PI) / 180

export function haversineM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// metres from the start at every point
export function cumulative(points) {
  const out = [0]
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + haversineM(points[i - 1], points[i]))
  return out
}

// up and down from top to bottom: a swing only counts once the way turns back
// by `step` m, so a GPS track's jitter doesn't add hundreds of metres — but
// every top and bottom counts in full (a summit, a turnaround, the route's end)
export function climb(points, step = 5) {
  let up = 0, down = 0, from = null, ext = null, dir = 0
  for (const p of points) {
    const e = p.ele
    if (typeof e !== 'number') continue
    if (from == null) from = e
    else if (dir === 0) { if (Math.abs(e - from) >= step) { dir = Math.sign(e - from); ext = e } }
    else if (dir * (e - ext) > 0) ext = e
    else if (dir * (ext - e) >= step) {
      if (dir > 0) up += ext - from; else down += from - ext
      dir = -dir; from = ext; ext = e
    }
  }
  if (dir > 0) up += ext - from
  else if (dir < 0) down += from - ext
  return { ascentM: Math.round(up), descentM: Math.round(down) }
}

export function highestIndex(points) {
  let hi = 0
  points.forEach((p, i) => { if ((p.ele ?? -Infinity) > (points[hi].ele ?? -Infinity)) hi = i })
  return hi
}

// distance of p from the segment a–b, flat projection, metres
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

// Douglas–Peucker ranks every point by how much shape it carries (a child
// never outranks its parent); the top ones are kept, plus the ends and the
// highest point.
export function simplify(points, maxPoints = 500) {
  const n = points.length
  if (n <= maxPoints) return points.slice()
  const lat0 = rad(points[0].lat)
  const xy = points.map(p => [rad(p.lon) * Math.cos(lat0) * R, rad(p.lat) * R])
  const rank = new Float64Array(n).fill(-1)
  const stack = [[0, n - 1, Infinity]]
  while (stack.length) {
    const [a, b, cap] = stack.pop()
    let best = -1, idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = segDist(xy[i], xy[a], xy[b])
      if (d > best) { best = d; idx = i }
    }
    if (idx < 0) continue
    rank[idx] = Math.min(best, cap)
    stack.push([a, idx, rank[idx]], [idx, b, rank[idx]])
  }
  const forced = new Set([0, n - 1, highestIndex(points)])
  const order = [...rank.keys()].filter(i => !forced.has(i)).sort((x, y) => rank[y] - rank[x])
  const keep = new Set([...forced, ...order.slice(0, Math.max(0, maxPoints - forced.size))])
  return [...keep].sort((x, y) => x - y).map(i => points[i])
}

// up to the top and back down the same way
export const withReturn = points => points.concat(points.slice(0, -1).reverse())

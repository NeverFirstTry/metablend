import { cumulative } from '@/lib/route/geometry'

// Elevation over distance, the stage points marked green (fine) or red
// (blocked). Points without an elevation are skipped.
export default function RouteProfile({ points, stages }) {
  const pts = points.map(p => ({ lat: p[0], lon: p[1], ele: p[2] }))
  const dist = cumulative(pts)
  const eles = pts.map(p => p.ele).filter(v => typeof v === 'number')
  if (eles.length < 2) return null
  const W = 600, H = 140, L = 40, R = 8, T = 10, B = 20
  const max = Math.max(...eles), min = Math.min(...eles), total = dist.at(-1) || 1
  const x = d => L + (d / total) * (W - L - R)
  const y = e => T + (1 - (e - min) / Math.max(1, max - min)) * (H - T - B)
  let line = '', first = null, last = null
  pts.forEach((p, i) => {
    if (typeof p.ele !== 'number') return
    line += `${line ? 'L' : 'M'}${x(dist[i]).toFixed(1)},${y(p.ele).toFixed(1)}`
    first ??= i
    last = i
  })
  const area = `${line}L${x(dist[last]).toFixed(1)},${H - B}L${x(dist[first]).toFixed(1)},${H - B}Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${Math.round(min)}–${Math.round(max)} m, ${(total / 1000).toFixed(1)} km`}>
      <path d={area} fill="var(--accent)" opacity="0.15" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />
      <text x={L - 6} y={y(max) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(max)}</text>
      <text x={L - 6} y={y(min)} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(min)}</text>
      <text x={W - R} y={H - 4} textAnchor="end" fontSize="10" fill="var(--muted)">{(total / 1000).toFixed(1)} km</text>
      {stages?.map(s => (typeof pts[s.i]?.ele === 'number'
        ? <circle key={s.i} cx={x(dist[s.i])} cy={y(pts[s.i].ele)} r="4" fill={s.blocker ? 'var(--bad)' : 'var(--ok)'} />
        : null))}
    </svg>
  )
}

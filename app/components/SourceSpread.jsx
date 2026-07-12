// The one-glance version of what MetaBlend does: every reporting source as a
// dot on a shared temperature scale, the blended consensus as the only
// accent-colored mark. One series of peer dots (so no legend, no per-source
// hues); the source cards below the fold remain the full table view.
//
// Scale: always centered on the consensus and at least ±4 °C wide, growing
// only when a source falls outside. That keeps the visual honest — a tight
// cluster reads tight, scatter reads scattered — instead of stretching every
// spread to the full width.
export default function SourceSpread({ sources, consensusC, unit = 'C', title, hint, brand = 'MetaBlend' }) {
  const pts = (sources ?? [])
    .filter(s => !s.down && typeof s.temp === 'number')
    .map(s => ({ id: s.apiId, name: s.displayName ?? s.apiId, tempC: s.temp }))
  if (pts.length < 3 || typeof consensusC !== 'number') return null

  const show = c => (unit === 'F' ? c * 9 / 5 + 32 : c)
  const maxDev = Math.max(...pts.map(p => Math.abs(p.tempC - consensusC)))
  const half = Math.max(4, Math.ceil(maxDev + 1))
  const lo = consensusC - half
  const x = c => ((c - lo) / (2 * half)) * 100

  // beeswarm-lite: dots closer than ~3.2% of the width stack into lanes
  const laneEnds = []
  const dots = [...pts].sort((a, b) => a.tempC - b.tempC).map(p => {
    const px = x(p.tempC)
    let lane = laneEnds.findIndex(end => px - end >= 3.2)
    if (lane === -1) lane = Math.min(laneEnds.length, 3)
    laneEnds[lane] = px
    return { ...p, px, lane: Math.min(lane, 3) }
  })

  // recessive guides on even °C values; skip the outermost positions so
  // centered labels can't clip at the container edges
  const ticks = []
  for (let tc = Math.ceil(lo / 2) * 2; tc <= lo + 2 * half; tc += 2) {
    if (x(tc) >= 4 && x(tc) <= 96) ticks.push(tc)
  }

  return (
    <div className="mt-6 mb-5">
      <div className="text-zinc-500 text-xs uppercase tracking-widest mb-2">{title}</div>
      {/* consensus label — the marker is always at 50% by construction */}
      <div className="text-center text-xs text-emerald-400 font-bold tabular-nums mb-1">
        {brand} {show(consensusC).toFixed(1)}°{unit}
      </div>
      <div className="relative h-16" role="img" aria-label={`${title}: ${pts.length} · ${brand} ${show(consensusC).toFixed(1)}°${unit}`}>
        <div className="absolute left-0 right-0 bottom-4 h-px bg-zinc-800" aria-hidden />
        {ticks.map(tc => (
          <div key={tc} aria-hidden>
            <div className="absolute bottom-2.5 h-1.5 w-px bg-zinc-800 -translate-x-1/2" style={{ left: `${x(tc)}%` }} />
            <div className="absolute bottom-0 -translate-x-1/2 text-[10px] text-zinc-600 tabular-nums" style={{ left: `${x(tc)}%` }}>
              {Math.round(show(tc))}°
            </div>
          </div>
        ))}
        <div
          className="absolute top-0 bottom-2.5 w-0.5 bg-emerald-400 rounded-full -translate-x-1/2"
          style={{ left: '50%' }}
          aria-hidden
        />
        {dots.map(d => (
          <span
            key={d.id}
            title={`${d.name}: ${show(d.tempC).toFixed(1)}°${unit}`}
            aria-label={`${d.name}: ${show(d.tempC).toFixed(1)}°${unit}`}
            className="absolute w-2.5 h-2.5 rounded-full bg-zinc-400/80 ring-2 ring-zinc-900 -translate-x-1/2 hover:bg-emerald-300 hover:z-10 transition-colors cursor-default"
            style={{ left: `${d.px}%`, bottom: `${18 + d.lane * 11}px` }}
          />
        ))}
      </div>
      <p className="text-zinc-500 text-xs mt-2">{hint}</p>
    </div>
  )
}

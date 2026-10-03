'use client'

import { formatCalendarDate } from '@/lib/localtime'
import { chartSummary } from '@/lib/a11y-text'
import { tempFormatter } from '@/lib/outlook/text'
import useWidth from './useWidth'

// Consensus temperature over the hours shown, the sources' spread as a band
// behind it, and rain chance as bars along the bottom. Colours via CSS
// variables (style, not SVG attributes) so both themes work.
export default function HourlyChart({ hours, unit = 'C', lang = 'en', height = 170 }) {
  const [ref, W] = useWidth()
  if (!hours?.length) return null
  const H = height, top = 18, axis = 18, rainH = 28
  const bottom = H - axis, tempBottom = bottom - rainH - 8
  const conv = c => (unit === 'F' ? c * 9 / 5 + 32 : c)
  const mid = hours.map(h => conv(h.temp))
  const lo = hours.map(h => conv(h.lo ?? h.temp)), hi = hours.map(h => conv(h.hi ?? h.temp))
  const min = Math.min(...lo), max = Math.max(...hi), range = max - min || 1
  const x = i => 10 + (i / Math.max(1, hours.length - 1)) * (W - 20)
  const y = v => top + (1 - (v - min) / range) * (tempBottom - top)
  const pt = (v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`
  const band = [...hi.map(pt), ...lo.map(pt).reverse()].join(' ')
  const barW = Math.max(2, (W - 20) / hours.length - 1.5)
  const iMax = mid.indexOf(Math.max(...mid)), iMin = mid.indexOf(Math.min(...mid))
  const every = hours.length > 30 ? 6 : 3
  const ticks = hours
    .map((h, i) => ({ h, i, hr: Number(h.t.slice(11, 13)) }))
    .filter(({ h, hr }) => h.t.slice(14, 16) === '00' && hr % every === 0)
  const clampX = v => Math.min(Math.max(v, 16), W - 16)
  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} role="img" aria-label={chartSummary(lang, hours, tempFormatter(unit))}>
        <polygon points={band} style={{ fill: 'var(--accent)', fillOpacity: 0.14 }} />
        {ticks.filter(tk => tk.hr === 0).map(tk => (
          <line key={`d${tk.h.t}`} x1={x(tk.i)} x2={x(tk.i)} y1={top - 8} y2={bottom} strokeDasharray="2 3" style={{ stroke: 'var(--muted)', strokeOpacity: 0.35 }} />
        ))}
        <polyline points={mid.map(pt).join(' ')} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: 'var(--accent)' }} />
        {hours.map((h, i) => h.rainPct > 0 && (
          <rect key={h.t} x={x(i) - barW / 2} y={bottom - (h.rainPct / 100) * rainH} width={barW} height={(h.rainPct / 100) * rainH}
            style={{ fill: 'var(--info)', fillOpacity: 0.25 + h.rainPct / 250 }} />
        ))}
        <text x={clampX(x(iMax))} y={y(mid[iMax]) - 6} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--hot)' }}>{Math.round(mid[iMax])}°</text>
        <text x={clampX(x(iMin))} y={y(mid[iMin]) + 15} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: 'var(--info)' }}>{Math.round(mid[iMin])}°</text>
        {ticks.map(({ h, i, hr }) => (
          <text key={`t${h.t}`} x={clampX(x(i))} y={H - 4} textAnchor="middle" fontSize="11" style={{ fill: 'var(--muted)' }}>
            {hr === 0 ? formatCalendarDate(h.t.slice(0, 10), lang, { weekday: 'short' }) : h.t.slice(11, 13)}
          </text>
        ))}
      </svg>
    </div>
  )
}

'use client'

import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'
import useWidth from './useWidth'

// 14-day highs and lows against the 10-year normal. The bands are the spread
// (sources in week 1, ensemble members in week 2), so uncertainty visibly
// grows with range; the divider marks where forecast turns into trend.
export default function TrendChart({ days, normals, unit = 'C', lang = 'en' }) {
  const [ref, W] = useWidth()
  if (!days?.length) return null
  const H = 200, top = 16, bottom = H - 40
  const conv = c => (c == null ? null : unit === 'F' ? c * 9 / 5 + 32 : c)
  const normal = new Map((normals ?? []).map(n => [n.date, n]))
  const all = days
    .flatMap(d => [d.maxHi ?? d.tempMax, d.minLo ?? d.tempMin, normal.get(d.date)?.max, normal.get(d.date)?.min])
    .map(conv).filter(v => v != null)
  const min = Math.min(...all), max = Math.max(...all), range = max - min || 1
  const x = i => 14 + (i / Math.max(1, days.length - 1)) * (W - 28)
  const y = v => top + (1 - (v - min) / range) * (bottom - top)
  const xy = (i, v) => `${x(i).toFixed(1)},${y(conv(v)).toFixed(1)}`
  const line = key => days.map((d, i) => (d[key] == null ? null : xy(i, d[key]))).filter(Boolean).join(' ')
  const band = (hiKey, loKey, fb) => [
    ...days.map((d, i) => xy(i, d[hiKey] ?? d[fb])),
    ...days.map((d, i) => xy(i, d[loKey] ?? d[fb])).reverse(),
  ].join(' ')
  const normalLine = days.map((d, i) => (normal.get(d.date)?.max == null ? null : xy(i, normal.get(d.date).max))).filter(Boolean).join(' ')
  const split = days.findIndex(d => d.lead >= 8)
  const splitX = split > 0 ? (x(split - 1) + x(split)) / 2 : null
  const last = days.at(-1)
  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} role="img" aria-label={t(lang, 'tab14d')}>
        <polygon points={band('maxHi', 'maxLo', 'tempMax')} style={{ fill: 'var(--hot)', fillOpacity: 0.13 }} />
        <polygon points={band('minHi', 'minLo', 'tempMin')} style={{ fill: 'var(--info)', fillOpacity: 0.13 }} />
        {normalLine && <polyline points={normalLine} fill="none" strokeDasharray="4 4" strokeWidth="1.5" style={{ stroke: 'var(--muted)' }} />}
        <polyline points={line('tempMax')} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: 'var(--hot)' }} />
        <polyline points={line('tempMin')} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: 'var(--info)' }} />
        {splitX != null && <line x1={splitX} x2={splitX} y1={top - 6} y2={bottom} style={{ stroke: 'var(--muted)', strokeOpacity: 0.5 }} />}
        {days.map((d, i) => i % 2 === 0 && (
          <text key={d.date} x={x(i)} y={bottom + 14} textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted)' }}>
            {formatCalendarDate(d.date, lang, { weekday: 'short' })}
          </text>
        ))}
        <text x={14} y={H - 6} fontSize="10" style={{ fill: 'var(--muted)' }}>{t(lang, 'thisWeekConfident')}</text>
        {splitX != null && <text x={splitX + 6} y={H - 6} fontSize="10" style={{ fill: 'var(--muted)' }}>{t(lang, 'nextWeekTrend')}</text>}
        {normalLine && normal.get(last.date)?.max != null && (
          <text x={W - 14} y={y(conv(normal.get(last.date).max)) - 5} textAnchor="end" fontSize="10" style={{ fill: 'var(--muted)' }}>{t(lang, 'normalLine')}</text>
        )}
      </svg>
    </div>
  )
}

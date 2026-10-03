'use client'

import { t } from '@/lib/i18n'
import { isDark, nightIcon } from '@/lib/sky'
import ScrollStrip from '../ScrollStrip'

export const STORM_COLOR = { low: 'var(--ok)', moderate: 'var(--warn)', high: 'var(--bad)' }

// Hour-by-hour summit row: time, icon, summit temperature, summit wind,
// freezing level, rain chance and a storm-risk bar. `sun` as in HourStrip.
export default function SummitStrip({ hours, fmtTemp, sun, lang }) {
  return (
    <ScrollStrip label={t(lang, 'hourByHour')}>
      <div className="flex gap-1.5 min-w-max">
        {hours.map(h => (
          <div key={h.t} className="w-16 shrink-0 bg-zinc-800/50 border border-zinc-800 rounded-xl py-2 text-center text-xs leading-relaxed">
            <div className="text-zinc-500 tabular-nums">{h.t.slice(11, 16)}</div>
            <div className="text-lg leading-tight" aria-hidden>{(isDark(h.t.slice(11, 16), sun) ? nightIcon(h.icon) : h.icon) ?? '·'}</div>
            <div className="font-bold tabular-nums">{fmtTemp(h.temp)}</div>
            <div className="tabular-nums text-zinc-400">{h.windKmh != null ? `${h.windKmh} km/h` : '–'}</div>
            <div className="tabular-nums text-zinc-500">{h.freezingLevel != null ? `${h.freezingLevel} m` : '–'}</div>
            <div className="tabular-nums" style={{ color: 'var(--info)' }}>{h.rainPct != null ? `${h.rainPct}%` : '–'}</div>
            <div className="mx-auto mt-1 h-1.5 w-8 rounded-full" style={{ background: STORM_COLOR[h.storm] ?? 'var(--muted)', opacity: h.storm ? 1 : 0.3 }} />
          </div>
        ))}
      </div>
    </ScrollStrip>
  )
}

export function StormLegend({ lang }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
      <span>{t(lang, 'stormRisk')}:</span>
      {['low', 'moderate', 'high'].map(k => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full" style={{ background: STORM_COLOR[k] }} />
          {t(lang, `storm${k[0].toUpperCase()}${k.slice(1)}`)}
        </span>
      ))}
    </div>
  )
}

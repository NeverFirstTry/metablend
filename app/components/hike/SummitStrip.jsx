'use client'

import { t } from '@/lib/i18n'
import { summitHourLabel, stormSegments } from '@/lib/a11y-text'
import { isDark, nightIcon } from '@/lib/sky'
import ScrollStrip from '../ScrollStrip'

export const STORM_COLOR = { low: 'var(--ok)', moderate: 'var(--warn)', high: 'var(--bad)' }

// Storm risk as 1 / 2 / 3 filled segments out of three, so it reads without the
// colour. `compact` for table rows; with `lang` it also says the level aloud.
export function StormBar({ storm, className = '', compact = false, lang = null }) {
  const n = stormSegments(storm)
  return (
    <span className={`flex gap-0.5 ${className}`}>
      {lang && storm && <span className="sr-only">{t(lang, 'stormRisk')}: {t(lang, `storm${storm[0].toUpperCase()}${storm.slice(1)}`)}</span>}
      {[0, 1, 2].map(i => (
        <span key={i} aria-hidden className={`${compact ? 'h-2.5 w-1' : 'h-1.5 w-2.5'} rounded-full`}
          style={i < n ? { background: STORM_COLOR[storm] } : { background: 'var(--muted)', opacity: 0.25 }} />
      ))}
    </span>
  )
}

// Hour-by-hour summit row: time, icon, summit temperature, summit wind,
// freezing level, rain chance and a storm-risk bar. `sun` as in HourStrip;
// screen readers get one sentence per card.
export default function SummitStrip({ hours, fmtTemp, sun, lang }) {
  return (
    <ScrollStrip label={t(lang, 'hourByHour')}>
      <div role="list" className="flex gap-1.5 min-w-max">
        {hours.map(h => (
          <div key={h.t} role="listitem" className="min-w-16 px-1 shrink-0 bg-zinc-800/50 border border-zinc-800 rounded-xl py-2 text-center text-xs leading-relaxed">
            <span className="sr-only">{summitHourLabel(lang, h, fmtTemp)}</span>
            <div className="text-zinc-500 tabular-nums" aria-hidden>{h.t.slice(11, 16)}</div>
            <div className="text-lg leading-tight" aria-hidden>{(isDark(h.t.slice(11, 16), sun) ? nightIcon(h.icon) : h.icon) ?? '·'}</div>
            <div className="font-bold tabular-nums" aria-hidden>{fmtTemp(h.temp)}</div>
            <div className="tabular-nums text-zinc-400" aria-hidden>{h.windKmh != null ? `${h.windKmh} km/h` : '–'}</div>
            <div className="tabular-nums text-zinc-500" aria-hidden>{h.freezingLevel != null ? `${h.freezingLevel} m` : '–'}</div>
            <div className="tabular-nums" style={{ color: 'var(--info)' }} aria-hidden>{h.rainPct != null ? `${h.rainPct}%` : '–'}</div>
            <StormBar storm={h.storm} className="mt-1 justify-center" />
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
          <StormBar storm={k} />
          {t(lang, `storm${k[0].toUpperCase()}${k.slice(1)}`)}
        </span>
      ))}
    </div>
  )
}

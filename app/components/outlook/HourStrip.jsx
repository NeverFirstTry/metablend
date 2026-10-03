'use client'

import { t } from '@/lib/i18n'
import { hourLabel } from '@/lib/a11y-text'
import { isDark, nightIcon } from '@/lib/sky'
import ScrollStrip from '../ScrollStrip'

// Scrollable hour-by-hour row: time, icon, temperature, rain chance.
// `sun` { sunrise, sunset } turns the icons of dark hours to the moon.
// Screen readers get one sentence per card instead of its four lines.
export default function HourStrip({ hours, fmtTemp, sun, lang }) {
  return (
    <ScrollStrip label={t(lang, 'hourByHour')}>
      <div role="list" className="flex gap-1.5 min-w-max">
        {hours.map(h => (
          <div key={h.t} role="listitem" className="w-14 shrink-0 bg-zinc-800/50 border border-zinc-800 rounded-xl py-2 text-center text-xs leading-relaxed">
            <span className="sr-only">{hourLabel(lang, h, fmtTemp)}</span>
            <div className="text-zinc-500 tabular-nums" aria-hidden>{h.t.slice(11, 16)}</div>
            <div className="text-lg leading-tight" aria-hidden>{(isDark(h.t.slice(11, 16), sun) ? nightIcon(h.icon) : h.icon) ?? '·'}</div>
            <div className="font-bold tabular-nums" aria-hidden>{fmtTemp(h.temp)}</div>
            <div className="tabular-nums" style={{ color: 'var(--info)' }} aria-hidden>{h.rainPct != null ? `${h.rainPct}%` : '–'}</div>
          </div>
        ))}
      </div>
    </ScrollStrip>
  )
}

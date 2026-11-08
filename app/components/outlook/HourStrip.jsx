'use client'

import { t } from '@/lib/i18n'
import { hourLabel } from '@/lib/a11y-text'
import { isDark, nightIcon } from '@/lib/sky'
import ScrollStrip from '../ScrollStrip'
import Glyph from '../Glyph'
import { Valued, ValueKey } from '../ValueKey'

// a rain chance worth noticing gets the rain colour; below it stays quiet
const RAIN_NOTABLE = 20

// Scrollable hour-by-hour row: time, icon, temperature, rain chance. The
// temperature leads (larger, bold, in ink); every column has the same width.
// `sun` { sunrise, sunset } turns the icons of dark hours to the moon.
// `nowLocal` ('YYYY-MM-DDTHH:MM', the place's time) marks the current hour.
// Screen readers get one sentence per hour instead of its four lines.
export default function HourStrip({ hours, fmtTemp, sun, lang, nowLocal = null }) {
  const nowHour = nowLocal?.slice(0, 13)
  return (
    <>
      <ScrollStrip label={t(lang, 'hourByHour')}>
        <div role="list" className="flex gap-1 min-w-max">
          {hours.map(h => {
            const isNow = h.t.slice(0, 13) === nowHour
            const notable = h.rainPct >= RAIN_NOTABLE
            return (
              <div key={h.t} role="listitem" aria-current={isNow ? 'time' : undefined}
                className="w-14 shrink-0 rounded-xl py-2 text-center"
                style={isNow ? { background: 'var(--surface-2)' } : undefined}>
                <span className="sr-only">{hourLabel(lang, h, fmtTemp)}</span>
                <div className="text-xs font-medium text-zinc-300 tabular-nums" aria-hidden>{h.t.slice(11, 16)}</div>
                <div className="text-xl leading-none my-2" aria-hidden><Glyph emoji={isDark(h.t.slice(11, 16), sun) ? nightIcon(h.icon) : h.icon} size={22} fallback="·" /></div>
                <div className="text-base font-bold leading-tight tabular-nums" style={{ color: 'var(--foreground)' }} aria-hidden>{fmtTemp(h.temp)}</div>
                <div className="text-xs mt-1" aria-hidden>
                  {h.rainPct != null
                    ? <Valued kind="rain" className={`tabular-nums ${notable ? 'font-semibold' : 'text-zinc-500'}`} style={notable ? { color: 'var(--info)' } : undefined}>{h.rainPct}%</Valued>
                    : <span className="text-zinc-500">–</span>}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollStrip>
      <ValueKey lang={lang} kinds={['rain']} className="mt-3" />
    </>
  )
}

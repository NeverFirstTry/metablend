'use client'

import { t } from '@/lib/i18n'
import { hourLabel } from '@/lib/a11y-text'
import { isDark, nightIcon } from '@/lib/sky'
import ScrollStrip from '../ScrollStrip'
import Glyph from '../Glyph'
import { Valued, ValueKey } from '../ValueKey'

// every rain chance in the rain colour; one worth noticing also in bold
const RAIN_NOTABLE = 20

// Scrollable hour-by-hour row, one small tile per hour (.hour-tile, globals.css):
// time, icon, temperature (the lead: largest, bold, in ink), rain chance.
// `sun` { sunrise, sunset } turns the icons of dark hours to the moon.
// `nowLocal` ('YYYY-MM-DDTHH:MM', the place's time) marks the current hour.
// Screen readers get one sentence per hour instead of its four lines.
export default function HourStrip({ hours, fmtTemp, sun, lang, nowLocal = null }) {
  const nowHour = nowLocal?.slice(0, 13)
  return (
    <>
      <ScrollStrip label={t(lang, 'hourByHour')}>
        <div role="list" className="flex gap-2 min-w-max">
          {hours.map(h => {
            const notable = h.rainPct >= RAIN_NOTABLE
            return (
              <div key={h.t} role="listitem" aria-current={h.t.slice(0, 13) === nowHour ? 'time' : undefined}
                className="hour-tile w-14 shrink-0 rounded-xl py-2.5 text-center">
                <span className="sr-only">{hourLabel(lang, h, fmtTemp)}</span>
                <div className="text-xs font-medium text-zinc-300 tabular-nums" aria-hidden>{h.t.slice(11, 16)}</div>
                <div className="leading-none my-1.5" aria-hidden><Glyph emoji={isDark(h.t.slice(11, 16), sun) ? nightIcon(h.icon) : h.icon} size={24} fallback="·" /></div>
                <div className="text-lg font-bold leading-tight tabular-nums" style={{ color: 'var(--foreground)' }} aria-hidden>{fmtTemp(h.temp)}</div>
                <div className="text-[0.8125rem] mt-0.5" aria-hidden>
                  {h.rainPct != null
                    ? <Valued kind="rain" className={`tabular-nums${notable ? ' font-semibold' : ''}`} style={{ color: 'var(--info)' }}>{h.rainPct}%</Valued>
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

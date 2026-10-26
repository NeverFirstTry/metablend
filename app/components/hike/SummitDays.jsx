import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'
import { StormBar, StormLegend } from './SummitStrip'
import { Valued, ValueKey } from '../ValueKey'

// The Week tab: per summit day low / high, strongest wind, freezing-level
// range and the worst storm risk, with a line under the card saying which is which.
export default function SummitDays({ days, todayLocal, lang, fmt }) {
  return (
    <div>
      <div className="@container bg-zinc-900 border border-zinc-800 rounded-2xl p-2 sm:p-4">
        {days.map(d => (
          <div key={d.date} className="flex items-center gap-2 sm:gap-3 px-2 py-3 text-sm border-t border-zinc-800 first:border-0 @max-[19rem]:flex-wrap">
            <span className="w-12 sm:w-16 shrink-0">{d.date === todayLocal ? t(lang, 'todayLabel') : formatCalendarDate(d.date, lang, { weekday: 'short' })}</span>
            <span className="w-6 shrink-0 text-center text-lg" aria-hidden>{d.icon ?? '·'}</span>
            <span className="w-24 shrink-0 tabular-nums"><span className="text-zinc-500">{fmt.fmtTemp(d.tempMin)}</span> / {fmt.fmtTemp(d.tempMax)}</span>
            {/* two short lines: side by side they never fitted a phone row */}
            <span className="flex-1 min-w-0 flex flex-col gap-0.5 text-zinc-400 text-xs tabular-nums @max-[19rem]:basis-full @max-[19rem]:order-last @max-[19rem]:flex-row @max-[19rem]:flex-wrap @max-[19rem]:gap-x-3">
              <span>{d.windMax != null ? <Valued kind="wind">{d.windMax} km/h</Valued> : '–'}</span>
              <span>{d.freezingMin != null ? <Valued kind="freezing">{d.freezingMin}–{d.freezingMax} m</Valued> : '–'}</span>
            </span>
            <StormBar storm={d.storm} compact lang={lang} className="shrink-0" />
          </div>
        ))}
      </div>
      <ValueKey lang={lang} kinds={['summitWind', 'freezing']} className="mt-3 px-1" />
      <StormLegend lang={lang} className="mt-1.5 px-1" />
    </div>
  )
}

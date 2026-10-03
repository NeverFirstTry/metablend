import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'
import { StormBar } from './SummitStrip'

// The Week tab: per summit day low / high, strongest wind, freezing-level
// range and the worst storm risk.
export default function SummitDays({ days, todayLocal, lang, fmt }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 sm:p-4">
      {days.map(d => (
        <div key={d.date} className="flex items-center gap-2 sm:gap-3 px-2 py-3 text-sm border-t border-zinc-800 first:border-0">
          <span className="w-12 sm:w-16 shrink-0">{d.date === todayLocal ? t(lang, 'todayLabel') : formatCalendarDate(d.date, lang, { weekday: 'short' })}</span>
          <span className="w-6 shrink-0 text-center text-lg" aria-hidden>{d.icon ?? '·'}</span>
          <span className="w-24 shrink-0 tabular-nums"><span className="text-zinc-500">{fmt.fmtTemp(d.tempMin)}</span> / {fmt.fmtTemp(d.tempMax)}</span>
          <span className="flex-1 min-w-0 truncate text-zinc-400 text-xs tabular-nums">
            {d.windMax != null ? `${d.windMax} km/h` : '–'} · {d.freezingMin != null ? `${d.freezingMin}–${d.freezingMax} m` : '–'}
          </span>
          <StormBar storm={d.storm} compact lang={lang} className="shrink-0" />
        </div>
      ))}
    </div>
  )
}

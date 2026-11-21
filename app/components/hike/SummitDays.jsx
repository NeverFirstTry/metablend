import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'
import { weekVerdict, headlineText, rowText } from '@/lib/hike/week'
import { StormBar, StormLegend } from './SummitStrip'
import { Valued, ValueKey } from '../ValueKey'
import Glyph from '../Glyph'
import Headline from '../outlook/Headline'

// The Week tab: first the verdict, the best day and its summit window (UX review P1: "Saturday or Sunday?"
// is asked here), then per summit day low / high, strongest wind, freezing-level range and the worst storm
// risk, each day with its window or why it has none, and a line under the card saying which is which.
// `windows`: /api/hike windows.days; an older answer without it shows the table alone, as before.
// `rain`: the rain chance under the temperatures (the website's summit page on a phone, UX review M1); two lines a day.
export default function SummitDays({ days, windows, todayLocal, lang, fmt, rain = false }) {
  const verdict = windows ? weekVerdict(windows, todayLocal) : null
  const head = verdict && headlineText(lang, verdict, todayLocal)
  return (
    <div className="space-y-4">
      {head && <Headline text={head} tone={head.tone} />}
      <div>
        <div className="@container bg-zinc-900 border border-zinc-800 rounded-2xl p-2 sm:p-4">
          {days.map(d => {
            const line = verdict ? rowText(lang, verdict.rows.get(d.date)) : null
            return (
              <div key={d.date} className="border-t border-zinc-800 first:border-0">
                <div className="flex items-center gap-2 sm:gap-3 px-2 py-3 text-sm @max-[19rem]:flex-wrap">
                  <span className="w-12 sm:w-16 shrink-0">{d.date === todayLocal ? t(lang, 'todayLabel') : formatCalendarDate(d.date, lang, { weekday: 'short' })}</span>
                  <span className="w-6 shrink-0 text-center text-lg" aria-hidden><Glyph emoji={d.icon} fallback="·" /></span>
                  <span className="w-24 shrink-0 tabular-nums"><span className="text-zinc-500">{fmt.fmtTemp(d.tempMin)}</span> / {fmt.fmtTemp(d.tempMax)}
                    {rain && d.rainPct != null && <span className="block text-xs text-zinc-400"><Valued kind="rain">{d.rainPct}%</Valued></span>}</span>
                  {/* two short lines: side by side they never fitted a phone row */}
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5 text-zinc-400 text-xs tabular-nums @max-[19rem]:basis-full @max-[19rem]:order-last @max-[19rem]:flex-row @max-[19rem]:flex-wrap @max-[19rem]:gap-x-3">
                    <span>{d.windMax != null ? <Valued kind="wind">{d.windMax} km/h</Valued> : '–'}</span>
                    <span>{d.freezingMin != null ? <Valued kind="freezing">{d.freezingMin}-{d.freezingMax} m</Valued> : '–'}</span>
                  </span>
                  <StormBar storm={d.storm} compact lang={lang} className="shrink-0" />
                </div>
                {/* the day's window, or why it has none; a cut-off last day has none to give */}
                {line && <p className="px-2 pb-3 -mt-1.5 text-xs text-zinc-300">{line}</p>}
              </div>
            )
          })}
        </div>
        <ValueKey lang={lang} kinds={rain ? ['summitWind', 'rain', 'freezing'] : ['summitWind', 'freezing']} className="mt-3 px-1" />
        <StormLegend lang={lang} className="mt-1.5 px-1" />
      </div>
    </div>
  )
}

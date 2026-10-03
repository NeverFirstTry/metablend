'use client'

import { useState } from 'react'
import { Thermometer, CloudRain } from 'lucide-react'
import { t } from '@/lib/i18n'
import { formatCalendarDate } from '@/lib/localtime'
import { headlineText, headlineTone, dayPhrase, fill } from '@/lib/outlook/text'
import { MetricCard } from '../ui'
import Headline from './Headline'
import HourlyChart from './HourlyChart'
import Notes from './Notes'

function Agree({ level, lang }) {
  if (level == null) return <span className="w-8 shrink-0" />
  const color = level >= 2 ? 'var(--ok)' : 'var(--warn)'
  return (
    <span role="img" className="w-8 shrink-0 text-xs tracking-tighter" title={t(lang, `agree${level}`)} aria-label={t(lang, `agree${level}`)}>
      <span style={{ color }}>{'●'.repeat(level)}</span>
      <span className="text-zinc-600">{'○'.repeat(3 - level)}</span>
    </span>
  )
}

export default function Tab7d({ outlook, unit, lang, fmt }) {
  const [openDay, setOpenDay] = useState(null)
  const todayLocal = outlook.nowLocal.slice(0, 10)
  const h = outlook.headlines?.d7
  const w1 = outlook.vsNormal?.week1
  const rd = outlook.rainyDays
  const days = outlook.days.slice(0, 7)
  const lo = Math.min(...days.map(d => d.tempMin)), hi = Math.max(...days.map(d => d.tempMax)), span = hi - lo || 1
  return (
    <div className="space-y-4 animate-fade-in">
      <Headline text={headlineText(lang, 'd7', h, { todayLocal, ...fmt })} tone={headlineTone('d7', h)} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 sm:p-4">
        {days.map(d => {
          const open = openDay === d.date
          const dayHours = outlook.hourly.filter(x => x.t.startsWith(d.date))
          return (
            <div key={d.date} className="border-t border-zinc-800 first:border-0">
              <button
                onClick={() => setOpenDay(open ? null : d.date)}
                aria-expanded={open}
                disabled={!dayHours.length}
                className="w-full flex items-center gap-2 sm:gap-3 px-2 py-3 text-sm text-left rounded-xl hover:bg-zinc-800/40 disabled:cursor-default"
              >
                <span className="w-12 sm:w-16 shrink-0">{d.date === todayLocal ? t(lang, 'todayLabel') : formatCalendarDate(d.date, lang, { weekday: 'short' })}</span>
                <span className="w-6 shrink-0 text-center text-lg" aria-hidden>{d.icon ?? '·'}</span>
                <span className="w-9 shrink-0 text-right text-zinc-500 tabular-nums">{fmt.fmtTemp(d.tempMin)}</span>
                <span className="relative flex-1 h-1.5 bg-zinc-800 rounded-full">
                  <span
                    className="absolute h-1.5 rounded-full"
                    style={{
                      left: `${((d.tempMin - lo) / span) * 100}%`,
                      width: `${Math.max(4, ((d.tempMax - d.tempMin) / span) * 100)}%`,
                      background: 'linear-gradient(90deg, var(--info), var(--hot))',
                    }}
                  />
                </span>
                <span className="w-9 shrink-0 tabular-nums">{fmt.fmtTemp(d.tempMax)}</span>
                <span className="w-10 shrink-0 text-right tabular-nums" style={{ color: 'var(--info)' }}>{d.rainPct != null ? `${d.rainPct}%` : '–'}</span>
                <Agree level={d.agree} lang={lang} />
              </button>
              {d.spread > 4 && (
                <div className="px-2 pb-2 -mt-1 text-xs" style={{ color: 'var(--warn)' }}>
                  ⚠ {fill(t(lang, 'hlSplit'), { spread: fmt.fmtSpan(d.spread), when: dayPhrase(lang, d.date, todayLocal) })}
                </div>
              )}
              {open && <div className="px-2 pb-4"><HourlyChart hours={dayHours} unit={unit} lang={lang} height={140} /></div>}
            </div>
          )
        })}
      </div>
      <p className="text-zinc-500 text-xs">{t(lang, 'agreeHint')}</p>
      {(w1 != null || rd?.of > 0) && (
        <div className="flex flex-wrap gap-3">
          {w1 != null && (
            <MetricCard icon={Thermometer} label={t(lang, 'vsNormal10')} value={fmt.fmtDelta(w1)} sub={t(lang, 'thisWeek')} color={w1 > 0 ? 'var(--hot)' : 'var(--info)'} />
          )}
          {rd?.of > 0 && (
            <MetricCard
              icon={CloudRain}
              label={t(lang, 'rainyDaysLabel')}
              value={fill(t(lang, 'rainyDaysValue'), { n: rd.forecast, total: rd.of })}
              sub={rd.normal != null ? fill(t(lang, 'normalValue'), { n: rd.normal }) : null}
              color="var(--info)"
            />
          )}
        </div>
      )}
      <Notes notes={outlook.notes} lang={lang} />
    </div>
  )
}

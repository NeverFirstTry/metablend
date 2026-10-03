'use client'

import { Clock, Sun, Thermometer, TrendingUp } from 'lucide-react'
import { t } from '@/lib/i18n'
import { addDays } from '@/lib/localtime'
import { headlineText, headlineTone } from '@/lib/outlook/text'
import { MetricCard, SectionTitle } from '../ui'
import Headline from './Headline'
import HourlyChart from './HourlyChart'
import HourStrip from './HourStrip'
import Notes from './Notes'

// Tomorrow as one whole day: its hours, the best time out, and how it
// compares with a normal year.
export default function TabTomorrow({ outlook, unit, lang, fmt }) {
  const todayLocal = outlook.nowLocal.slice(0, 10)
  const date = addDays(todayLocal, 1)
  const hours = outlook.hourly.filter(h => h.t.startsWith(date))
  const day = outlook.days.find(d => d.date === date)
  const h = outlook.headlines?.tomorrow
  const best = outlook.bestTime?.tomorrow
  return (
    <div className="space-y-4 animate-fade-in">
      <Headline text={headlineText(lang, 'tomorrow', h, { todayLocal, ...fmt })} tone={headlineTone('tomorrow', h)} />
      {hours.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
          <HourlyChart hours={hours} unit={unit} lang={lang} />
          <p className="text-zinc-500 text-xs mt-2">{t(lang, 'bandHint')}</p>
          <SectionTitle icon={Clock} className="mt-6 mb-3">{t(lang, 'hourByHour')}</SectionTitle>
          <HourStrip hours={hours} fmtTemp={fmt.fmtTemp} sun={outlook.sun} lang={lang} />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {best && (
          <MetricCard
            icon={Sun}
            label={t(lang, 'bestTimeOut')}
            value={`${best.icon ?? ''} ${best.t.slice(11, 16)}`}
            sub={`${fmt.fmtTemp(best.temp)} · ${best.rainPct ?? '–'}%`}
            color="var(--ok)"
          />
        )}
        {day && (
          <MetricCard
            icon={Thermometer}
            label={t(lang, 'highLowLabel')}
            value={`${fmt.fmtTemp(day.tempMax)} / ${fmt.fmtTemp(day.tempMin)}`}
            sub={day.agree != null ? t(lang, `agree${day.agree}`) : null}
            color={day.agree == null || day.agree >= 2 ? undefined : 'var(--warn)'}
          />
        )}
        {h?.vsNormal != null && (
          <MetricCard
            icon={TrendingUp}
            label={t(lang, 'vsNormal10')}
            value={fmt.fmtDelta(h.vsNormal)}
            sub={t(lang, 'tomorrowWord')}
            color={h.vsNormal > 0 ? 'var(--hot)' : 'var(--info)'}
          />
        )}
      </div>
      <Notes notes={outlook.notes} lang={lang} />
    </div>
  )
}

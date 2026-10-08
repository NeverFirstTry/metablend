'use client'

import { Clock, Sun, Wind, Flower2, CloudRain } from 'lucide-react'
import { t, uvText, aqiText, pollenText } from '@/lib/i18n'
import { headlineText, headlineTone } from '@/lib/outlook/text'
import { todayHours } from '@/lib/outlook/headlines'
import WarningsCard from './WarningsCard'
import { MetricCard, SectionTitle, Fold } from '../ui'
import RainRadar from '../RainRadar'
import Headline from './Headline'
import HourlyChart from './HourlyChart'
import HourStrip from './HourStrip'
import Notes from './Notes'
import NowcastCard from './NowcastCard'

const MUTED = 'var(--muted)', GREEN = 'var(--ok)', YELLOW = 'var(--warn)', RED = 'var(--bad)'
const uvColor = v => (v == null ? MUTED : v < 3 ? GREEN : v < 6 ? YELLOW : RED)
const aqiColor = v => (v == null ? MUTED : v <= 40 ? GREEN : v <= 80 ? YELLOW : RED)
const pollenColor = v => (v == null ? MUTED : v < 20 ? GREEN : v < 50 ? YELLOW : RED)

// The rest of today (through the night once it's evening), hour by hour.
export default function TabToday({ outlook, now, unit, lang, fmt }) {
  const todayLocal = outlook.nowLocal.slice(0, 10)
  const { hours } = todayHours(outlook.hourly, todayLocal)
  const h = outlook.headlines?.today
  const best = outlook.bestTime?.today
  const x = now?.extras
  return (
    <div className="space-y-4 animate-fade-in">
      <Headline text={headlineText(lang, 'today', h, { todayLocal, ...fmt })} tone={headlineTone('today', h)} />
      {now?.lat != null && now?.lon != null && <WarningsCard lat={now.lat} lon={now.lon} cc={outlook?.cc} lang={lang} todayLocal={todayLocal} />}
      {now?.lat != null && now?.lon != null && <NowcastCard lat={now.lat} lon={now.lon} lang={lang} />}
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
        {x?.uvIndex != null && <MetricCard icon={Sun} label={t(lang, 'uvLabel')} value={x.uvIndex} sub={uvText(lang, x.uvIndex)} color={uvColor(x.uvIndex)} />}
        {x?.aqi != null && <MetricCard icon={Wind} label={t(lang, 'aqiLabel')} value={x.aqi} sub={aqiText(lang, x.aqi)} color={aqiColor(x.aqi)} />}
        {x?.pollen != null && <MetricCard icon={Flower2} label={t(lang, 'pollenLabel')} value={x.pollen} sub={pollenText(lang, x.pollen)} color={pollenColor(x.pollen)} />}
      </div>
      <Notes notes={outlook.notes} lang={lang} />
      {outlook.lat != null && outlook.lon != null && (
        <Fold icon={CloudRain} title={t(lang, 'radarFold')}>
          <RainRadar lat={outlook.lat} lon={outlook.lon} bare />
        </Fold>
      )}
    </div>
  )
}

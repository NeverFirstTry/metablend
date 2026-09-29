'use client'

import { Thermometer, CloudRain, Trophy } from 'lucide-react'
import { t } from '@/lib/i18n'
import { headlineText, headlineTone, fill } from '@/lib/outlook/text'
import { MetricCard, Fold } from '../ui'
import Headline from './Headline'
import TrendChart from './TrendChart'
import Notes from './Notes'
import Records from './Records'

export default function Tab14d({ outlook, now, unit, lang, fmt }) {
  const todayLocal = outlook.nowLocal.slice(0, 10)
  const h = outlook.headlines?.d14
  const w1 = outlook.vsNormal?.week1
  const rd = outlook.rainyDays
  return (
    <div className="space-y-4 animate-fade-in">
      <Headline text={headlineText(lang, 'd14', h, { todayLocal, ...fmt })} tone={headlineTone('d14', h)} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
        <TrendChart days={outlook.days} normals={outlook.normals} unit={unit} lang={lang} />
        <p className="text-zinc-500 text-xs mt-2">{t(lang, 'trendBandHint')}</p>
      </div>
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
      <Notes notes={outlook.notes} lang={lang} />
      {outlook.records && (
        <Fold icon={Trophy} title={t(lang, 'recordsFold')}>
          <Records records={outlook.records} nowTemp={now?.consensus?.temp} lang={lang} fmt={fmt} />
        </Fold>
      )}
    </div>
  )
}

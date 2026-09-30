'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Clock, Wind, Snowflake, Zap, CloudOff, RotateCcw } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill, tempFormatter, deltaFormatter, spanFormatter } from '@/lib/outlook/text'
import { addDays } from '@/lib/localtime'
import { hikeApiPath } from '@/lib/hike/params'
import { windowText, windowTone } from '@/lib/hike/text'
import { worstStorm } from '@/lib/hike/blend'
import RangeTabs from '../outlook/RangeTabs'
import Headline from '../outlook/Headline'
import HourlyChart from '../outlook/HourlyChart'
import { MetricCard, SectionTitle } from '../ui'
import SummitStrip, { StormLegend, STORM_COLOR } from './SummitStrip'
import SummitDays from './SummitDays'
import HikeNotes from './HikeNotes'

// One peak's summit forecast: Today / Tomorrow / Week, like the city outlook.
// Mounted with key={peak.id}, so a new peak starts from a clean state.
export default function PeakView({ peak, lang, unit, onBack }) {
  const [tab, setTab] = useState('today')
  const [state, setState] = useState({ data: null, error: false })
  const [attempt, setAttempt] = useState(0)
  const url = hikeApiPath(peak)
  useEffect(() => {
    let off = false
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => { if (!off) setState({ data, error: false }) }, () => { if (!off) setState({ data: null, error: true }) })
    return () => { off = true }
  }, [url, attempt])
  const retry = () => { setState({ data: null, error: false }); setAttempt(a => a + 1) }
  const fmt = useMemo(() => ({ fmtTemp: tempFormatter(unit), fmtDelta: deltaFormatter(unit), fmtSpan: spanFormatter(unit) }), [unit])

  const d = state.data
  const todayLocal = d?.nowLocal?.slice(0, 10)
  const date = d && (tab === 'tomorrow' ? addDays(todayLocal, 1) : todayLocal)
  const hours = d ? d.hourly.filter(h => h.t.startsWith(date)) : []
  const w = d?.windows?.[tab]
  const nums = k => hours.map(h => h[k]).filter(v => typeof v === 'number')
  const fz = nums('freezingLevel'), winds = nums('windKmh')
  const worst = worstStorm(hours.map(h => h.storm))
  const stormUnknown = !!d?.notes?.includes('no_storm_data')

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
        <ArrowLeft size={15} aria-hidden /> {t(lang, 'hikeBack')}
      </button>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{peak.name}</h1>
        <p className="text-zinc-500 text-xs tracking-wider mt-1">
          <span title={peak.elevApprox ? t(lang, 'elevApprox') : undefined}>{peak.elevApprox ? '≈' : ''}{peak.elev} m</span>
          {peak.country ? ` · ${peak.country}` : ''}
          {d ? ` · ${fill(t(lang, 'hikeModels'), { n: d.sources.length })}` : ''}
        </p>
      </div>
      <RangeTabs value={tab} onChange={setTab} lang={lang} />
      {state.error ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-400 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2"><CloudOff size={16} aria-hidden /> {t(lang, 'hikeError')}</span>
          <button onClick={retry} className="press inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-400 hover:text-emerald-400">
            <RotateCcw size={13} aria-hidden /> {t(lang, 'retry')}
          </button>
        </div>
      ) : !d ? (
        <div className="h-64 rounded-2xl skeleton" />
      ) : tab === 'd7' ? (
        <SummitDays days={d.days} todayLocal={todayLocal} lang={lang} fmt={fmt} />
      ) : (
        <>
          <Headline text={windowText(lang, w, { date, todayLocal, stormUnknown })} tone={windowTone(w, { stormUnknown })} />
          {hours.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
              <HourlyChart hours={hours} unit={unit} lang={lang} />
              <SectionTitle icon={Clock} className="mt-6 mb-3">{t(lang, 'hourByHour')}</SectionTitle>
              <SummitStrip hours={hours} fmtTemp={fmt.fmtTemp} />
              <StormLegend lang={lang} />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {/* units in the sub-line: three cards side by side on a phone leave no room */}
            {winds.length > 0 && <MetricCard icon={Wind} label={t(lang, 'summitWind')} value={Math.max(...winds)} sub="km/h" />}
            {fz.length > 0 && <MetricCard icon={Snowflake} label={t(lang, 'freezingLevel')} value={Math.min(...fz)} sub={`– ${Math.max(...fz)} m`} />}
            {worst && <MetricCard icon={Zap} label={t(lang, 'stormRisk')} value={t(lang, `storm${worst[0].toUpperCase()}${worst.slice(1)}`)} color={STORM_COLOR[worst]} />}
          </div>
        </>
      )}
      {/* Today / Tomorrow carry this in the headline; the Week list has none */}
      {stormUnknown && tab === 'd7' && <p className="text-xs" style={{ color: 'var(--warn)' }}>{t(lang, 'hikeNoStorm')}</p>}
      <HikeNotes lang={lang} borrowed />
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Clock, Wind, Snowflake, Zap, CloudOff, RotateCcw } from 'lucide-react'
import { t, tn } from '@/lib/i18n'
import { tempFormatter, deltaFormatter, spanFormatter } from '@/lib/outlook/text'
import { addDays } from '@/lib/localtime'
import { hikeApiPath } from '@/lib/hike/params'
import { windowText, windowTone, defaultSummitTab, noDaylightPointer } from '@/lib/hike/text'
import { worstStorm } from '@/lib/hike/blend'
import { OM_MODELS } from '@/lib/outlook/models'
import { sourceName } from '@/lib/sources'
import { skyFor } from '@/lib/sky'
import { useSky } from '@/lib/useSky'
import RangeTabs from '../outlook/RangeTabs'
import Headline from '../outlook/Headline'
import HourlyChart from '../outlook/HourlyChart'
import { MetricCard, SectionTitle } from '../ui'
import SummitStrip, { StormLegend, STORM_COLOR } from './SummitStrip'
import SummitDays from './SummitDays'
import HikeNotes from './HikeNotes'
import SkyLoader from '../SkyLoader'
import PlanHike from './PlanHike'
import RouteList from './RouteList'
import { isNative } from '@/lib/native'
import WarningsCard from '../outlook/WarningsCard'
import AvalancheCard from './AvalancheCard'

// the models a summit request asks, for the loader's ticker
const SUMMIT_MODELS = OM_MODELS.map(m => sourceName(m.id))

// Summit forecasts already seen while the app runs: back on a peak (or back
// on the Hiking tab) shows it at once instead of the loader. Fresh for 10
// minutes (on top of the CDN copy's own age); the last 30 peaks only.
const SEEN = new Map() // url → { at, data }
const FRESH_MS = 10 * 60e3
const seen = url => { const c = SEEN.get(url); return c && Date.now() - c.at < FRESH_MS ? c.data : null }

// One peak's summit forecast: Today / Tomorrow / Week, like the city outlook.
// Mounted with key={peak.id}, so a new peak starts from a clean state.
export default function PeakView({ peak, lang, unit, onBack }) {
  const url = hikeApiPath(peak)
  // null until the user picks one: Today, or Tomorrow when today has no window left (after sunset)
  const [tab, setTab] = useState(null)
  const [state, setState] = useState(() => ({ data: seen(url), error: false }))
  const [attempt, setAttempt] = useState(0)
  const [native, setNative] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration environment sync
  useEffect(() => setNative(isNative()), [])
  useEffect(() => {
    if (attempt === 0 && seen(url)) return
    let off = false
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => {
        SEEN.delete(url); SEEN.set(url, { at: Date.now(), data })
        if (SEEN.size > 30) SEEN.delete(SEEN.keys().next().value)
        if (!off) setState({ data, error: false })
      }, () => { if (!off) setState({ data: null, error: true }) })
    return () => { off = true }
  }, [url, attempt])
  const retry = () => { setState({ data: null, error: false }); setAttempt(a => a + 1) }
  const fmt = useMemo(() => ({ fmtTemp: tempFormatter(unit), fmtDelta: deltaFormatter(unit), fmtSpan: spanFormatter(unit) }), [unit])

  const d = state.data
  const shown = tab ?? defaultSummitTab(d)
  const dark = shown === 'today' && d?.windows?.today === null // no daylight left today
  // the summit's sky right now
  useSky(d ? skyFor({ code: d.hourly?.[0]?.code, nowLocal: d.nowLocal, sun: d.sun }) : null)
  const todayLocal = d?.nowLocal?.slice(0, 10)
  const date = d && (shown === 'tomorrow' ? addDays(todayLocal, 1) : todayLocal)
  const hours = d ? d.hourly.filter(h => h.t.startsWith(date)) : []
  const w = d?.windows?.[shown]
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
        <h1 className="mb-rise text-3xl sm:text-4xl font-semibold tracking-tight">{peak.name}</h1>
        <p className="text-zinc-500 text-xs tracking-wider mt-1">
          <span title={peak.elevApprox ? t(lang, 'elevApprox') : undefined}>{peak.elevApprox ? '≈' : ''}{peak.elev} m</span>
          {peak.grade ? ` · ${t(lang, 'gradeScale')} ${peak.grade}` : ''}
          {peak.country ? ` · ${peak.country}` : ''}
          {d ? ` · ${tn(lang, 'hikeModels', d.sources.length)}` : ''}
        </p>
        {peak.grade && <p className="text-zinc-500 text-xs mt-1">{t(lang, 'gradeNote')}</p>}
      </div>
      <RangeTabs value={shown} onChange={setTab} lang={lang} />
      {native && d && <PlanHike peak={peak} lang={lang} unit={unit} todayLocal={todayLocal} />}
      {state.error ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-400 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2"><CloudOff size={16} aria-hidden /> {t(lang, 'hikeError')}</span>
          <button onClick={retry} className="press inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-400 hover:text-emerald-400">
            <RotateCcw size={13} aria-hidden /> {t(lang, 'retry')}
          </button>
        </div>
      ) : !d ? (
        <SkyLoader lang={lang} title={t(lang, 'loadingSummit')} names={SUMMIT_MODELS} />
      ) : shown === 'd7' ? (
        <SummitDays days={d.days} todayLocal={todayLocal} lang={lang} fmt={fmt} />
      ) : dark ? (
        // after sunset: one line to tomorrow's window instead of a mostly empty page
        <>
          <Headline text={noDaylightPointer(lang, d)} onClick={() => setTab('tomorrow')} />
          <WarningsCard lat={peak.lat} lon={peak.lon} cc={peak.country} lang={lang} todayLocal={todayLocal} />
          <AvalancheCard lat={peak.lat} lon={peak.lon} lang={lang} />
        </>
      ) : (
        <>
          <Headline text={windowText(lang, w, { date, todayLocal, stormUnknown })} tone={windowTone(w, { stormUnknown })} />
          <WarningsCard lat={peak.lat} lon={peak.lon} cc={peak.country} lang={lang} todayLocal={todayLocal} />
          <AvalancheCard lat={peak.lat} lon={peak.lon} lang={lang} />
          {hours.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
              <HourlyChart hours={hours} unit={unit} lang={lang} />
              <SectionTitle icon={Clock} className="mt-6 mb-3">{t(lang, 'hourByHour')}</SectionTitle>
              <SummitStrip hours={hours} fmtTemp={fmt.fmtTemp} sun={d.sunByDate?.[date] ?? d.sun} lang={lang} />
              <StormLegend lang={lang} className="mt-1.5" />
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
      {stormUnknown && shown === 'd7' && <p className="text-xs" style={{ color: 'var(--warn)' }}>{t(lang, 'hikeNoStorm')}</p>}
      <RouteList peak={peak} lang={lang} />
      <HikeNotes lang={lang} borrowed />
    </div>
  )
}

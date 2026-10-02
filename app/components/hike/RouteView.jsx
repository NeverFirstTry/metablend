'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CloudOff, RotateCcw, Save, Check, Footprints } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill, tempFormatter, dayWord, dayPhrase } from '@/lib/outlook/text'
import { addDays } from '@/lib/localtime'
import { localToday } from '@/lib/app-widget-sync'
import { highestIndex, withReturn } from '@/lib/route/geometry'
import { routeStats } from '@/lib/route/timing'
import { REASON_KEY } from '@/lib/route/reasons'
import { SectionTitle } from '../ui'
import { STORM_COLOR } from './SummitStrip'
import RouteMap from './RouteMap'
import RouteProfile from './RouteProfile'

const PACES = [['slow', 'paceSlow'], ['normal', 'paceNormal'], ['fast', 'paceFast']]
const asPoints = list => list.map(p => ({ lat: p[0], lon: p[1], ele: p[2] }))
const duration = m => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`

// One route: map, profile, stats, day / pace / start, the suggestion and the
// stages along the way. route = { id, name, source, roundTrip, points }.
export default function RouteView({ route, lang, unit, onBack, onSave, saved, children }) {
  const today = localToday()
  const [date, setDate] = useState(today)
  const [pace, setPace] = useState('normal')
  const [start, setStart] = useState(null) // null = the suggestion
  const [attempt, setAttempt] = useState(0)
  const [res, setRes] = useState({ key: null, data: null, error: false })
  const key = [date, pace, start ?? '', attempt].join('|')

  useEffect(() => {
    let off = false
    fetch('/api/route-weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: route.points, date, pace, start, roundTrip: !!route.roundTrip }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => { if (!off) setRes({ key, data, error: false }) }, () => { if (!off) setRes(r => ({ key, data: r.data, error: true })) })
    return () => { off = true }
  }, [key, route, date, pace, start])

  const loading = res.key !== key
  const d = res.data
  const fmt = useMemo(() => tempFormatter(unit), [unit])
  const local = useMemo(() => routeStats(route.roundTrip ? withReturn(asPoints(route.points)) : asPoints(route.points), pace), [route, pace])
  const stats = d?.stats ?? local
  const points = d?.points ?? route.points
  const highIdx = d ? d.stages.find(s => s.high)?.i : highestIndex(asPoints(route.points))
  const days = Array.from({ length: 7 }, (_, k) => addDays(today, k))
  const word = date2 => { const w = dayWord(lang, date2, today); return w.charAt(0).toLocaleUpperCase(lang) + w.slice(1) }
  const s = d?.suggestion
  const why = s?.none && s.firstBad ? fill(t(lang, 'routeWhyNot'), { reason: t(lang, REASON_KEY[s.reason]), eta: s.firstBad.eta, km: d.stages[s.firstBad.i]?.km ?? '–' }) : s?.none ? t(lang, REASON_KEY[s.reason]) : null
  const label = (st, k) => (k === 0 ? t(lang, 'routeStartLabel') : k === d.stages.length - 1 ? t(lang, 'routeFinishLabel') : st.high ? t(lang, 'routeHigh') : `km ${st.km}`)

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
        <ArrowLeft size={15} aria-hidden /> {t(lang, 'hikeBack')}
      </button>
      <div>
        <h1 className="mb-rise text-3xl sm:text-4xl font-semibold tracking-tight">{route.name || t(lang, 'routesTitle')}</h1>
        <p className="text-zinc-500 text-xs tracking-wider mt-1">
          {stats.distanceKm} km · ↑{stats.ascentM} m · ↓{stats.descentM} m · ~{duration(stats.minutes)}{route.roundTrip ? ` · ${t(lang, 'routeRoundTrip')}` : ''}
        </p>
      </div>

      <RouteMap points={points} highIndex={highIdx} />
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3"><RouteProfile points={points} stages={d?.stages} /></div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(lang, 'planPick')}>
        {days.map(x => (
          <button key={x} onClick={() => { setDate(x); setStart(null) }} aria-pressed={date === x}
            className={`press rounded-lg px-3 py-1.5 text-sm ${date === x ? 'bg-emerald-400 text-black font-semibold' : 'bg-zinc-800 hover:text-emerald-400'}`}>{word(x)}</button>
        ))}
      </div>
      <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1 w-fit" role="group" aria-label="Pace">
        {PACES.map(([p, k]) => (
          <button key={p} onClick={() => setPace(p)} aria-pressed={pace === p}
            className={`press rounded-lg px-3 py-1 text-sm inline-flex items-center gap-1 ${pace === p ? 'bg-zinc-900 text-emerald-400' : 'text-zinc-400'}`}>
            {p === pace && <Footprints size={13} aria-hidden />}{t(lang, k)}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2" aria-live="polite">
        {res.error && !loading ? (
          <div className="text-sm text-zinc-400 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2"><CloudOff size={16} aria-hidden /> {t(lang, 'routeWeatherFail')}</span>
            <button onClick={() => setAttempt(a => a + 1)} className="press inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-400 hover:text-emerald-400">
              <RotateCcw size={13} aria-hidden /> {t(lang, 'retry')}
            </button>
          </div>
        ) : !d || loading ? (
          <p className="text-sm text-zinc-500">{t(lang, 'routeLoading')}</p>
        ) : s.none ? (
          <>
            <p className="text-lg font-semibold" style={{ color: 'var(--bad)' }}>{fill(t(lang, 'routeNoStart'), { day: dayPhrase(lang, date, today) })}</p>
            {why && <p className="text-sm text-zinc-400">{why}</p>}
            {s.nextDay && (
              <button onClick={() => { setDate(s.nextDay.date); setStart(null) }} className="press text-sm text-emerald-400 underline underline-offset-4">
                {fill(t(lang, 'routeNextDay'), { day: word(s.nextDay.date), start: s.nextDay.start })}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-semibold" style={{ color: 'var(--ok)' }}>
              {fill(t(lang, s.start === s.latest ? 'routeStartAt' : 'routeStartWindow'), { from: s.start, to: s.latest })} · {fill(t(lang, 'routeSummitBack'), { high: s.highAt, finish: s.finish })}
            </p>
            <p className="text-xs text-zinc-500">{t(lang, 'routeSafeNote')}</p>
          </>
        )}
        {d && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="text-xs text-zinc-500 inline-flex items-center gap-2">
              {t(lang, 'routeOwnStart')}
              <input type="time" step="900" value={start ?? d.start} min={d.sun?.sunrise ?? undefined} max={d.sun?.sunset ?? undefined}
                onChange={e => e.target.value && setStart(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-200" />
            </label>
            {start && <button onClick={() => setStart(null)} className="press text-xs text-emerald-400">{t(lang, 'routeUseSuggestion')}</button>}
          </div>
        )}
        {stats.longerThanDay && <p className="text-xs" style={{ color: 'var(--warn)' }}>{t(lang, 'routeLongerThanDay')}</p>}
      </div>

      {d && !loading && (
        <section className="space-y-2">
          <SectionTitle>{t(lang, 'routeStages')}</SectionTitle>
          <ol className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
            {d.stages.map((st, k) => (
              <li key={st.i} className="flex items-center gap-3 px-4 py-2.5 text-sm" style={st.blocker ? { background: 'color-mix(in srgb, var(--bad) 12%, transparent)' } : undefined}>
                <span className="w-12 font-semibold tabular-nums">{st.eta}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{label(st, k)}</span>
                  <span className="block text-xs text-zinc-500">{st.ele != null ? `${st.ele} m` : ''}{st.blocker ? ` · ${t(lang, REASON_KEY[st.blocker])}` : ''}</span>
                </span>
                <span aria-hidden>{st.icon ?? ''}</span>
                <span className="w-24 text-right tabular-nums">{fmt(st.temp)} <span className="text-zinc-500 text-xs">({fmt(st.feels)})</span></span>
                <span className="w-16 text-right text-xs text-zinc-400 tabular-nums">{st.wind ?? '–'} km/h</span>
                <span className="w-10 text-right text-xs text-zinc-400 tabular-nums">{st.rain ?? '–'}%</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STORM_COLOR[st.storm] ?? 'var(--muted)' }} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {onSave && (
          <button onClick={onSave} disabled={saved} className="press inline-flex items-center gap-1.5 text-sm text-emerald-400 border border-emerald-400/40 rounded-full px-3 py-1.5 hover:bg-emerald-400/10 disabled:opacity-70">
            {saved ? <Check size={14} aria-hidden /> : <Save size={14} aria-hidden />} {t(lang, saved ? 'routeSaved' : 'routeSave')}
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

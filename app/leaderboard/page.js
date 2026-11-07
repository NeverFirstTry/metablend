'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Map as MapIcon, AlertTriangle } from 'lucide-react'
import { t, tn } from '@/lib/i18n'
import { sparkLabel } from '@/lib/a11y-text'
import { sourceName } from '@/lib/sources'
import { useLang } from '@/lib/useLang'
import BetaBanner from '../components/BetaBanner'
import Footer from '../components/Footer'
import SkyLoader from '../components/SkyLoader'
import { REGION_KEYS } from '@/lib/trusted'
import { isAppView } from '@/lib/app-client'
import { visitorRegion } from '@/lib/visitor-region'

function name(id, fallback) {
  const n = sourceName(id)
  return n !== id ? n : fallback ?? id
}

// "Right now" is the live ranking; the other two rank the outlook's
// predictions per range, scored once their time has come.
const HORIZONS = [['now', 'lbRightNow'], ['h48', 'lbTodayTomorrow'], ['d7', 'tabWeek']]
const LEARNING_BELOW = 200 // checks per region before a range stops saying "still learning"

// Tiny bar sparkline of recent scoring deltas (−2…+2): green = the source was
// close to the truth that report, red = it was off. Up / down carries the
// same without colour; screen readers get the counts.
function Sparkline({ data, lang }) {
  if (!Array.isArray(data) || data.length < 2) return null
  const recent = data.slice(-24)
  const bw = 4, gap = 1, h = 18, mid = h / 2
  return (
    <svg width={recent.length * (bw + gap)} height={h} className="block" role="img" aria-label={sparkLabel(lang, data)}>
      {recent.map((d, i) => {
        const c = Math.max(-2, Math.min(2, d))
        const barH = Math.max(1, (Math.abs(c) / 2) * (mid - 1))
        const y = c >= 0 ? mid - barH : mid
        const fill = c > 0 ? 'var(--ok)' : c < 0 ? 'var(--bad)' : 'var(--neutral)'
        return <rect key={i} x={i * (bw + gap)} y={y} width={bw} height={barH} style={{ fill }} rx={0.5} />
      })}
    </svg>
  )
}

// The ranking, on the website and in the app: one row per source, like the
// forecast page's source list. On a phone each number carries its label.
function RankList({ apis, lang }) {
  const most = Math.max(...apis.map(a => a.weight ?? 0)) || 1
  const stat = (key, value, style) => (
    <div className="rank-stat">
      <span className="tabular-nums" style={style}>{value}</span>
      <span className="rank-label text-xs text-zinc-400">{t(lang, key)}</span>
    </div>
  )
  return (
    <div className="rank-table">
      <div className="rank-row rank-head text-xs text-zinc-400" aria-hidden="true">
        <span /><span />
        <span>{t(lang, 'lbWeight')}</span>
        <span className="rank-stats">
          {['lbScore', 'lbReports', 'lbAvgScore', 'lbAvgResponse', 'lbRecent'].map(k => <span key={k}>{t(lang, k)}</span>)}
        </span>
      </div>
      <ol className="rank-list">
        {apis.map((api, i) => (
          <li key={api.id} className="rank-row">
            <span className="rank-n tabular-nums text-zinc-400">{i + 1}</span>
            <div className="rank-source min-w-0">
              <div className="font-semibold break-words">{name(api.id, api.name)}</div>
              <div className="text-xs text-zinc-400 break-words">{api.id}</div>
            </div>
            <div className="rank-weight">
              <span className="tabular-nums font-semibold">{(api.weight * 100).toFixed(1)}%<span className="sr-only"> {t(lang, 'lbWeight')}</span></span>
              <div className="source-bar flex-1 h-1 rounded-full" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${((api.weight ?? 0) / most) * 100}%`, background: 'var(--accent)' }} />
              </div>
            </div>
            <div className="rank-stats">
              {stat('lbScore', api.score ?? 0)}
              {stat('lbReports', api.reports ?? 0)}
              {stat('lbAvgScore', api.reports > 0 ? (api.score / api.reports).toFixed(2) : '–')}
              {stat('lbAvgResponse', api.avgMs != null ? `${Math.round(api.avgMs)}ms` : '–')}
              <div className="rank-stat rank-spark">
                {api.delta_history?.length > 1 ? <Sparkline data={api.delta_history} lang={lang} /> : <span aria-hidden>–</span>}
                <span className="rank-label text-xs text-zinc-400">{t(lang, 'lbRecent')}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-zinc-400 text-sm mt-4">{t(lang, 'lbScoreHint')}</p>
    </div>
  )
}

export default function Leaderboard() {
  const lang = useLang()
  const [regions, setRegions] = useState(null)
  const [horizons, setHorizons] = useState({})
  const [horizon, setHorizon] = useState('now')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(() => visitorRegion())

  function loadLeaderboard() {
    return fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setRegions(d.regions ?? [])
        setHorizons(d.horizons ?? {})
      })
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    loadLeaderboard().finally(() => setLoading(false))
  }, [])

  const list = horizon === 'now' ? regions : horizons?.[horizon] ?? []
  const current = list?.find(r => r.region === active) ?? list?.[0]
  const checks = current?.apis?.reduce((n, a) => n + (a.reports ?? 0), 0) ?? 0
  // the app's region labels carry an emoji; the website has none
  const regionLabel = id => {
    const label = REGION_KEYS[id] ? t(lang, REGION_KEYS[id]) : id
    return isAppView() ? label : label.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F]/gu, '').trim()
  }

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">

        <div className="app-only flex items-center justify-between mb-6">
          <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
          </Link>
          <Link href="/heatmap" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <MapIcon size={15} aria-hidden /> {t(lang, 'lbHeatmap')}
          </Link>
        </div>

        <h1 className="mb-rise text-3xl sm:text-4xl font-semibold tracking-tight mb-1">{t(lang, 'leaderboard')}</h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          {t(lang, 'lbSubtitle')}
        </p>

        <BetaBanner lang={lang} className="mb-6" />

        {/* Range tabs */}
        <div role="tablist" className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4">
          {HORIZONS.map(([id, key]) => (
            <button
              key={id}
              role="tab"
              aria-selected={horizon === id}
              onClick={() => setHorizon(id)}
              className={`press flex-1 text-xs py-2 rounded-lg transition-colors ${horizon === id ? 'bg-emerald-400 text-black font-bold' : 'text-zinc-400 hover:text-emerald-400'}`}
            >
              {t(lang, key)}
            </button>
          ))}
        </div>
        {horizon !== 'now' && (
          <p className="text-zinc-500 text-xs mb-6">
            {t(lang, 'lbHorizonHint')}
            {checks < LEARNING_BELOW && list?.length > 0 && <span className="block mt-1" style={{ color: 'var(--warn)' }}>{tn(lang, 'lbLearning', checks)}</span>}
          </p>
        )}

        {loading && <SkyLoader lang={lang} title={t(lang, 'lbLoading')} names={[]} />}

        {error && (
          <div className="animate-scale-in bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden /> {error}
          </div>
        )}

        {list && list.length > 0 && (
          <>
            {/* Region tabs */}
            <div className="flex gap-2 flex-wrap mb-6">
              {list.map(r => (
                <button
                  key={r.region}
                  onClick={() => setActive(r.region)}
                  className={`press text-xs px-3 py-2 rounded-lg border ${
                    current?.region === r.region
                      ? 'bg-emerald-400 text-black border-emerald-400 font-bold'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-emerald-400'
                  }`}
                >
                  {regionLabel(r.region)}
                </button>
              ))}
            </div>

            {current && <RankList apis={current.apis} lang={lang} />}
          </>
        )}

        {list && list.length === 0 && !error && !loading && (
          <p className="text-zinc-500 text-sm">{horizon === 'now' ? t(lang, 'lbNoData') : tn(lang, 'lbLearning', 0)}</p>
        )}

        <Footer lang={lang} />
      </div>
    </main>
  )
}

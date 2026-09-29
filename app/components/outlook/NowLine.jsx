'use client'

import { useState } from 'react'
import { ChevronDown, Wind, Droplets, Eye, CloudFog, Snowflake, Thermometer } from 'lucide-react'
import { t, translateCondition } from '@/lib/i18n'
import { MetricCard } from '../ui'
import { conditionIcon, heroCondition } from './icons'

const MUTED = 'var(--muted)', GREEN = 'var(--ok)', YELLOW = 'var(--warn)', RED = 'var(--bad)'
const cloudColor = v => (v == null ? MUTED : v < 30 ? GREEN : v < 70 ? YELLOW : RED)
const visColor = v => (v == null ? MUTED : v >= 10 ? GREEN : v >= 4 ? YELLOW : RED)

// "Right now", reduced to one line — the future tabs below are the main
// event. Tapping it opens everything the old hero showed.
export default function NowLine({ data, unit, lang, showT, showDelta }) {
  const [open, setOpen] = useState(false)
  const c = data.consensus
  const condition = heroCondition(data)
  const agreeColor = c.confidencePct >= 70 ? 'var(--ok)' : c.confidencePct >= 45 ? 'var(--warn)' : 'var(--bad)'
  const d = data.details
  const yd = data.yesterdayTemp != null ? Math.round((c.temp - data.yesterdayTemp) * 10) / 10 : null
  const rainingHint = data.rainingNow?.count > 0
    ? t(lang, 'rainNowHint').replace('{n}', data.rainingNow.count).replace('{total}', data.rainingNow.total)
    : null
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-left">
        <span className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider shrink-0">{t(lang, 'nowWord')}</span>
          <span className="text-2xl font-bold tabular-nums shrink-0">{showT(c.temp)}°{unit}</span>
          {condition && <span className="text-xl shrink-0" aria-hidden>{conditionIcon(condition, data.lon)}</span>}
          {condition && <span className="text-zinc-400 text-sm truncate hidden sm:inline">{translateCondition(lang, condition)}</span>}
        </span>
        <span className="flex items-center gap-3 shrink-0 text-xs">
          {rainingHint
            ? <span className="hidden sm:inline" style={{ color: 'var(--info)' }}>{rainingHint}</span>
            : c.rainPct != null && <span className="text-zinc-400 tabular-nums">🌧 {c.rainPct}%</span>}
          <span className="tabular-nums" style={{ color: agreeColor }}>{c.confidencePct}% {t(lang, 'agreeShort')}</span>
          <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-zinc-800 animate-fade-in space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
            {c.feelsLike != null && <span>{t(lang, 'feelsLike')} {showT(c.feelsLike)}°{unit}</span>}
            <span className="inline-flex items-center gap-1"><Wind size={13} aria-hidden /> {c.windKmh} km/h</span>
            {rainingHint && <span style={{ color: 'var(--info)' }}>{rainingHint}</span>}
            {yd != null && (Math.abs(yd) < 0.5
              ? <span>= {t(lang, 'vsYesterdaySame')}</span>
              : (
                <span style={{ color: yd > 0 ? 'var(--ok)' : 'var(--info)' }}>
                  {yd > 0 ? '↑' : '↓'} {Math.abs(showDelta(yd)).toFixed(1)}°{unit} {t(lang, yd > 0 ? 'vsYesterdayWarmer' : 'vsYesterdayColder')}
                </span>
              ))}
          </div>
          {d && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard icon={CloudFog} label={t(lang, 'cloudLabel')} value={d.cloudCover != null ? `${d.cloudCover}%` : '–'} color={cloudColor(d.cloudCover)} />
              <MetricCard icon={Eye} label={t(lang, 'visibilityLabel')} value={d.visibilityKm != null ? `${d.visibilityKm} km` : '–'} color={visColor(d.visibilityKm)} />
              <MetricCard icon={Droplets} label={t(lang, 'precipLabel')} value={d.precipMm != null ? `${d.precipMm} mm` : '–'} color={d.precipMm > 0 ? 'var(--info)' : 'var(--ok)'} />
              <MetricCard icon={Snowflake} label={t(lang, 'snowfallLabel')} value={d.snowfallMm != null ? `${d.snowfallMm} mm` : '–'} color={d.snowfallMm > 0 ? 'var(--info)' : 'var(--muted)'} />
              <MetricCard icon={Thermometer} label={t(lang, 'groundTempLabel')} value={d.groundTemp != null ? `${showT(d.groundTemp)}°${unit}` : '–'} color="var(--neutral)" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

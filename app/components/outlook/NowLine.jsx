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
export default function NowLine({ data, unit, lang, showT, showDelta, dark = null }) {
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
    <div>
      {/* the hero: the temperature as a big light numeral, straight on the sky */}
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-end justify-between gap-4 text-left group">
        <span className="flex items-end gap-4 min-w-0">
          {/* whole degrees in the hero — the tenths live in the details */}
          <span className="mb-rise text-7xl sm:text-8xl font-extralight tabular-nums leading-[0.85] tracking-tight shrink-0">
            {Math.round(Number(showT(c.temp)))}°
          </span>
          <span className="mb-rise-2 min-w-0 pb-1 space-y-0.5 text-sm">
            {condition && (
              <span className="flex items-center gap-2 text-lg sm:text-xl font-medium">
                <span aria-hidden>{conditionIcon(condition, data.lon, dark)}</span>
                <span className="truncate">{translateCondition(lang, condition)}</span>
              </span>
            )}
            {c.feelsLike != null && (
              <span className="block text-zinc-400 tabular-nums">{t(lang, 'feelsLike')} {Math.round(Number(showT(c.feelsLike)))}°</span>
            )}
            <span className="block tabular-nums whitespace-nowrap">
              <span style={{ color: agreeColor }}>{c.confidencePct}% {t(lang, 'agreeShort')}</span>
              {c.rainPct > 0 && !rainingHint && <span className="text-zinc-400"> · 🌧 {c.rainPct}%</span>}
            </span>
            {rainingHint && <span className="block" style={{ color: 'var(--info)' }}>{rainingHint}</span>}
          </span>
        </span>
        <ChevronDown size={18} className={`mb-2 shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 sm:px-5 py-4 animate-fade-in space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-1"><Wind size={13} aria-hidden /> {c.windKmh} km/h</span>
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

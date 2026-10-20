'use client'

import { useEffect, useState } from 'react'
import { Snowflake } from 'lucide-react'
import { t } from '@/lib/i18n'
import { AVA_COLORS, AVA_LINK } from '@/lib/avalanche/avalanche'
import { SectionTitle } from '../ui'

// The official avalanche danger for the summit's area, today and tomorrow
// (once out): level number and word, the EAWS colour only as an accent.
// Nothing at all out of season or outside avalanche regions.
const round = v => Math.round(v * 100) / 100

export default function AvalancheCard({ lat, lon, lang }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    let off = false
    fetch(`/api/avalanche?lat=${round(lat)}&lon=${round(lon)}`)
      .then(r => (r.ok ? r.json() : null), () => null)
      .then(j => { if (!off) setData(j) })
    return () => { off = true }
  }, [lat, lon])
  const days = [['avaToday', data?.today], ['avaTomorrow', data?.tomorrow]].filter(([, level]) => level)
  if (!days.length) return null
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2" aria-label={t(lang, 'avaTitle')}>
      <SectionTitle icon={Snowflake}>{t(lang, 'avaTitle')}</SectionTitle>
      <ul className="space-y-1.5">
        {days.map(([key, level]) => (
          <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="w-20 shrink-0 text-zinc-400">{t(lang, key)}</span>
            <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded font-bold text-xs"
              style={{ background: AVA_COLORS[level], color: level === 5 ? '#fff' : '#111' }}>{level}</span>
            <span className="min-w-0 font-medium"><span className="sr-only">{level} – </span>{t(lang, `avaLevel${level}`)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">
        {t(lang, 'avaNote')} · <a href={AVA_LINK} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-400">{t(lang, 'avaSource')}</a>
      </p>
    </section>
  )
}

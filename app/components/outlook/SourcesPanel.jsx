'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { t } from '@/lib/i18n'
import SourceDots from '../SourceDots'
import SourceList from '../SourceList'
import Credits from '../Credits'

// "Who's right now": every live source's current reading and its learned
// weight, with the spread on top: one quiet row per source, on the website and
// in the app alike. Folded away on the forecast page.
export default function SourcesPanel({ data, unit, lang }) {
  return (
    <div className="space-y-6">
      <SourceDots
        sources={data.sources}
        consensusC={data.consensus.temp}
        unit={unit}
        title={t(lang, 'spreadTitle')}
        hint={t(lang, 'spreadDotsHint')}
      />
      <SourceList data={data} unit={unit} lang={lang} />
      <div className="space-y-3">
        {/* WeatherAPI.com's terms: its end-user disclaimer stands with the data; the full notice is on /terms */}
        {data.sources?.some(s => s.apiId === 'weatherapi' && !s.down) && (
          <p className="text-zinc-500 text-xs leading-relaxed"><Link href="/terms#weatherapi-notice" className="underline decoration-dotted underline-offset-2 hover:text-emerald-400">{t(lang, 'weatherApiNote')}</Link></p>
        )}
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors uppercase tracking-widest">
          <Trophy size={13} aria-hidden /> {t(lang, 'leaderboard')}
        </Link>
        <p className="text-zinc-500 text-xs leading-relaxed"><Credits lang={lang} /></p>
      </div>
    </div>
  )
}

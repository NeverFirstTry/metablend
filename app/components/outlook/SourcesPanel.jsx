'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { t, translateCondition } from '@/lib/i18n'
import SourceSpread from '../SourceSpread'

// "Who's right now": every live source's current reading and its learned
// weight, with the spread strip on top. Folded away on the forecast page.
export default function SourcesPanel({ data, unit, lang, showT, showDelta }) {
  return (
    <div className="space-y-4">
      <SourceSpread
        sources={data.sources}
        consensusC={data.consensus.temp}
        unit={unit}
        title={t(lang, 'spreadTitle')}
        hint={t(lang, 'spreadHint')}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* house model first — the API appends it last */}
        {[...data.sources].sort((a, b) => (b.apiId === 'metablend') - (a.apiId === 'metablend')).map(src => {
          const weight = data.weights[src.apiId] ?? 0.25

          // Down source — failed / timed out
          if (src.down) {
            return (
              <div key={src.apiId} className="bg-zinc-900 border border-red-500/30 rounded-xl p-5 opacity-80">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-bold">{src.displayName ?? src.apiId}</div>
                  <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/40 rounded px-2 py-0.5">● {t(lang, 'sourceDown')}</span>
                </div>
                <div className="text-zinc-500 text-sm">{t(lang, 'noResponse')}{src.responseMs ? ` · ${src.responseMs}ms` : ''}</div>
              </div>
            )
          }

          const diff = Math.abs(src.temp - data.consensus.temp)
          const diffColor = diff <= 1 ? 'text-emerald-400' : diff <= 2.5 ? 'text-yellow-400' : 'text-red-400'
          // MetaBlend Local is the house model — the one card that IS the product
          const isLocal = src.apiId === 'metablend'
          return (
            <div
              key={src.apiId}
              className={`bg-zinc-900 border rounded-xl p-5 ${isLocal ? 'border-emerald-400/40 shadow-[0_0_24px_-8px] shadow-emerald-400/20' : 'border-zinc-800'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{src.displayName ?? src.apiId}</span>
                  {isLocal && (
                    <span className="text-[10px] bg-emerald-400/15 text-emerald-400 border border-emerald-400/30 rounded px-1.5 py-0.5 tracking-wider">
                      {t(lang, 'localBadge')}
                    </span>
                  )}
                  {src.responseMs != null && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 rounded px-1.5 py-0.5">{src.responseMs}ms</span>
                  )}
                </div>
                <div className={`text-xs ${diffColor}`}>
                  {diff <= 1 ? t(lang, 'equalsConsensus') : `±${showDelta(diff).toFixed(1)}°${unit}`}
                </div>
              </div>
              <div className="text-4xl font-bold mb-1 tabular-nums">{showT(src.temp)}°{unit}</div>
              {src.feelsLike !== undefined && (
                <div className="text-zinc-500 text-xs mb-1">{t(lang, 'feelsLike')} {showT(src.feelsLike)}°{unit}</div>
              )}
              {/* only sources with a real rain probability show a % */}
              <div className="text-zinc-500 text-sm mb-4">{translateCondition(lang, src.condition)}{src.rainPct != null ? ` · ${src.rainPct}%` : ''}</div>
              <div className="flex items-center gap-2">
                <div className="text-zinc-500 text-xs">{t(lang, 'weightLabel')}</div>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-[width] duration-700 ease-out" style={{ width: `${weight * 100}%` }} />
                </div>
                <div className="text-emerald-400 text-xs tabular-nums">{(weight * 100).toFixed(0)}%</div>
              </div>
            </div>
          )
        })}
      </div>
      <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors uppercase tracking-widest">
        <Trophy size={13} aria-hidden /> {t(lang, 'leaderboard')}
      </Link>
    </div>
  )
}

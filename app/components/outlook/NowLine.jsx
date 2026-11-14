'use client'

import { showRainNow } from '@/lib/forecast-hints'
import { t, translateCondition } from '@/lib/i18n'
import { conditionIcon, heroCondition } from '@/lib/conditions'
import { tempFormatter } from '@/lib/outlook/text'
import { liveSources, spreadSentence, agreeColor } from '@/lib/spread'
import Glyph from '../Glyph'

export const yesterdayDelta = data => (data.yesterdayTemp != null ? Math.round((data.consensus.temp - data.yesterdayTemp) * 10) / 10 : null)

// "Right now", reduced to one line — the future tabs below are the main event.
// The rest of right now is in the Current details fold right below (NowDetails); this line says how
// far the sources agree. Website and app render the same: the start page renders
// it on the server, which can't know it's the app (lib/app-parity.test.js).
export default function NowLine({ data, unit, lang, showT, dark = null }) {
  const c = data.consensus
  const condition = heroCondition(data)
  const agreeTint = agreeColor(c.confidencePct)
  const rainingHint = showRainNow(data.rainingNow)
    ? t(lang, 'rainNowHint').replace('{n}', data.rainingNow.count).replace('{total}', data.rainingNow.total)
    : null
  // the hero: the temperature as a big light numeral, straight on the page
  // (large text: the details drop below the numeral)
  return (
    <div className="@container">
      <span className="flex items-start gap-4 min-w-0 @max-[18rem]:flex-wrap">
        {/* whole degrees in the hero — the tenths live in the details */}
        <span className="mb-rise text-7xl sm:text-8xl font-extralight tabular-nums leading-[0.85] tracking-tight shrink-0">
          {Math.round(Number(showT(c.temp)))}°
        </span>
        <span className="mb-rise-2 min-w-0 pb-1 space-y-0.5 text-sm">
          {condition && (
            <span className="flex items-center gap-2 text-lg sm:text-xl font-medium">
              <span aria-hidden><Glyph emoji={conditionIcon(condition, data.lon, dark)} /></span>
              <span className="truncate">{translateCondition(lang, condition)}</span>
            </span>
          )}
          {c.feelsLike != null && (
            <span className="block text-zinc-400 tabular-nums">{t(lang, 'feelsLike')} {Math.round(Number(showT(c.feelsLike)))}°</span>
          )}
          {/* one source can't agree with anything: its 100% would mislead */}
          {liveSources(data.sources).length !== 1 && (
            <span className="block tabular-nums whitespace-nowrap @max-[18rem]:whitespace-normal">
              <span style={{ color: agreeTint }}>{c.confidencePct}% {t(lang, 'agreeShort')}</span>
              {c.rainPct > 0 && !rainingHint && <span className="text-zinc-400"> · <Glyph emoji="🌧" size={14} /> {c.rainPct}%</span>}
            </span>
          )}
          {rainingHint && <span className="block" style={{ color: 'var(--info)' }}>{rainingHint}</span>}
          <span className="block mt-2 max-w-md text-zinc-300">{spreadSentence(lang, data.sources, tempFormatter(unit), c.confidencePct)}</span>
        </span>
      </span>
    </div>
  )
}

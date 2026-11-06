'use client'

import { Wind, Droplets, Eye, CloudFog, Snowflake, Thermometer } from 'lucide-react'
import { t } from '@/lib/i18n'
import { yesterdayDelta } from './NowLine'

// The rest of "right now" on the website, as one of the rows below the tiles.
// The fold is the card, so no cards in it; nothing here is a status, so every
// value has the same colour. (The app shows these under its hero: NowLine.)
export default function NowDetails({ data, unit, lang, showT, showDelta }) {
  const d = data.details
  const value = (v, suffix = '') => (v != null ? `${v}${suffix}` : '–')
  const rows = [
    [Wind, 'windLabel', value(data.consensus.windKmh, ' km/h')],
    ...(d ? [
      [CloudFog, 'cloudLabel', value(d.cloudCover, '%')],
      [Eye, 'visibilityLabel', value(d.visibilityKm, ' km')],
      [Droplets, 'precipLabel', value(d.precipMm, ' mm')],
      [Snowflake, 'snowfallLabel', value(d.snowfallMm, ' mm')],
      [Thermometer, 'groundTempLabel', d.groundTemp != null ? `${showT(d.groundTemp)}°${unit}` : '–'],
    ] : []),
  ]
  const yd = yesterdayDelta(data)
  return (
    <div className="px-1 sm:px-0" style={{ color: 'var(--foreground)' }}>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        {rows.map(([Icon, key, shown]) => (
          <div key={key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-zinc-400"><Icon size={13} className="shrink-0" aria-hidden /> {t(lang, key)}</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">{shown}</dd>
          </div>
        ))}
      </dl>
      {yd != null && (
        <p className="mt-4 text-sm">
          {Math.abs(yd) < 0.5
            ? `= ${t(lang, 'vsYesterdaySame')}`
            : `${yd > 0 ? '↑' : '↓'} ${Math.abs(showDelta(yd)).toFixed(1)}°${unit} ${t(lang, yd > 0 ? 'vsYesterdayWarmer' : 'vsYesterdayColder')}`}
        </p>
      )}
    </div>
  )
}

import { Droplet, Wind, Snowflake } from 'lucide-react'
import { t } from '@/lib/i18n'

// What the numbers mean: every kind of number carries the same small icon
// wherever it appears, and a card ends with one line that names the icons.
// Screen readers skip the icons — they get a whole sentence per hour or day.
const KINDS = {
  rain: { Icon: Droplet, label: 'precipChanceLabel', color: 'var(--info)' },
  wind: { Icon: Wind, label: 'windLabel' },
  summitWind: { Icon: Wind, label: 'summitWind' },
  freezing: { Icon: Snowflake, label: 'freezingLevel' },
}

// a number with its icon, e.g. <Valued kind="rain">24%</Valued>. Never broken
// across lines ("63 / km/h"); icons sized in em so they grow with Larger Text.
export function Valued({ kind, children, className = '', style }) {
  const { Icon } = KINDS[kind]
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap ${className}`} style={style}>
      <Icon aria-hidden size="0.9em" strokeWidth={2.25} className="shrink-0 opacity-80" />
      {children}
    </span>
  )
}

// the line under a card: icon + name per kind, then anything else (children). `rainLabel`: what the drop is
// called on this card, by what falls at the temperatures shown (lib/precip.js chanceLabelKey: rain, snow or
// the neutral word); a card that does not say gets the neutral word, never "rain"
export function ValueKey({ lang, kinds, children, className = '', rainLabel }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 ${className}`}>
      {kinds.map(k => {
        const { Icon, label, color } = KINDS[k]
        return (
          <span key={k} className="inline-flex items-center gap-1">
            <Icon aria-hidden size="1em" strokeWidth={2.25} className="shrink-0" style={color ? { color } : undefined} />
            {t(lang, (k === 'rain' && rainLabel) || label)}
          </span>
        )
      })}
      {children}
    </p>
  )
}

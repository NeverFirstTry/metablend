import Link from 'next/link'
import { Apple, Play, FlaskConical } from 'lucide-react'
import { t } from '@/lib/i18n'
import { STORES } from '@/lib/hike/stores'

// App Store / Google Play — "Coming soon" until the listings exist.
export default function StoreBadges({ lang }) {
  const badge = (Icon, label, url) => {
    const cls = 'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold'
    return url
      ? <a key={label} href={url} className={`${cls} border-emerald-400 bg-emerald-400 text-black hover:bg-emerald-300`}><Icon size={16} aria-hidden /> {label}</a>
      : <span key={label} className={`${cls} border-zinc-700 text-zinc-400`}><Icon size={16} aria-hidden /> {label} · {t(lang, 'comingSoon')}</span>
  }
  // before the listings exist: point people at the beta instead
  const beta = !(STORES.ios && STORES.android) && (
    <Link href="/testers" className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:underline">
      <FlaskConical size={15} aria-hidden /> {t(lang, 'testersBecome')}
    </Link>
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">{badge(Apple, 'App Store', STORES.ios)}{badge(Play, 'Google Play', STORES.android)}</div>
      {beta}
    </div>
  )
}

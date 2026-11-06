import Link from 'next/link'
import { Apple, Play, FlaskConical } from 'lucide-react'
import { t } from '@/lib/i18n'
import { STORES } from '@/lib/hike/stores'

// App Store / Google Play once both listings exist; until then a plain beta note.
export default function StoreBadges({ lang }) {
  if (!STORES.ios || !STORES.android) {
    return (
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold">{t(lang, 'storeBetaNote')}</span>
        <Link href="/testers" className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline">
          <FlaskConical size={15} aria-hidden /> {t(lang, 'testersBecome')}
        </Link>
      </p>
    )
  }
  const cls = 'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold border-emerald-400 bg-emerald-400 text-black hover:bg-emerald-300'
  return (
    <div className="flex flex-wrap gap-3">
      <a href={STORES.ios} className={cls}><Apple size={16} aria-hidden /> App Store</a>
      <a href={STORES.android} className={cls}><Play size={16} aria-hidden /> Google Play</a>
    </div>
  )
}

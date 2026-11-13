import Link from 'next/link'
import { FlaskConical } from 'lucide-react'
import { t } from '@/lib/i18n'
import { STORES } from '@/lib/hike/stores'
import OfficialBadges from '../OfficialBadges'

// The stores' own badges from launch day (lib/hike/stores.js); until then a plain beta note. The page's
// Footer then passes badges={false}: one App Store badge per page.
export default function StoreBadges({ lang }) {
  if (!STORES.ios && !STORES.android) {
    return (
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold">{t(lang, 'storeBetaNote')}</span>
        <Link href="/testers" className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline">
          <FlaskConical size={15} aria-hidden /> {t(lang, 'testersBecome')}
        </Link>
      </p>
    )
  }
  return <OfficialBadges lang={lang} />
}

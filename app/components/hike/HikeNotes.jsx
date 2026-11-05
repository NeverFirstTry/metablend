import Link from 'next/link'
import { t } from '@/lib/i18n'

// The small print every hiking view carries.
export default function HikeNotes({ lang, borrowed = false }) {
  return (
    <div className="space-y-2 text-xs text-zinc-500 leading-relaxed">
      {borrowed && <p>{t(lang, 'hikeBorrowed')}</p>}
      <p style={{ color: 'var(--warn)' }}>{t(lang, 'hikeDisclaimer')} <Link href="/terms#disclaimer" className="underline">{t(lang, 'legalDisclaimerLink')}</Link></p>
      <p>{t(lang, 'hikeOsm')}</p>
    </div>
  )
}

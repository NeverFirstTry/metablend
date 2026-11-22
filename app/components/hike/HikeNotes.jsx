import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { t } from '@/lib/i18n'

// The small print every hiking view carries. The caution sentence in the warning colour with its icon: the warning
// yellow sits near the gold in dark, and the icon says it is a caution, not the screen's answer (X3).
export default function HikeNotes({ lang, borrowed = false }) {
  return (
    <div className="space-y-2 text-xs text-zinc-500 leading-relaxed">
      {borrowed && <p>{t(lang, 'hikeBorrowed')}</p>}
      <p className="flex gap-1.5" style={{ color: 'var(--warn)' }}>
        <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />
        <span>{t(lang, 'hikeDisclaimer')} <Link href="/terms#disclaimer" className="underline">{t(lang, 'legalDisclaimerLink')}</Link></span>
      </p>
      <p>{t(lang, 'hikeOsm')}</p>
    </div>
  )
}

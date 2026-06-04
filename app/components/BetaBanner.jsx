import { t } from '@/lib/i18n'

// Shared "in development" notice. Defaults to English for the secondary pages;
// the home page passes the active language.
export default function BetaBanner({ lang = 'en', className = '' }) {
  return (
    <div className={`bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 text-amber-300/90 text-xs flex items-start gap-2 ${className}`}>
      <span className="shrink-0">🚧</span>
      <span>{t(lang, 'betaDisclaimer')}</span>
    </div>
  )
}

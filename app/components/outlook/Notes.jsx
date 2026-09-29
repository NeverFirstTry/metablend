import { t } from '@/lib/i18n'

const KEYS = { fewer_sources: 'noteFewerSources', ensemble_unavailable: 'noteEnsembleUnavailable' }

// Honest footnotes when the outlook runs on fewer sources than usual.
export default function Notes({ notes, lang }) {
  const shown = (notes ?? []).filter(n => KEYS[n])
  if (!shown.length) return null
  return (
    <div className="text-xs rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2" style={{ color: 'var(--warn)' }}>
      {shown.map(n => t(lang, KEYS[n])).join(' · ')}
    </div>
  )
}

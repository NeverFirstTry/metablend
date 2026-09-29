import { AlertTriangle, RefreshCw } from 'lucide-react'
import { t } from '@/lib/i18n'

export function OutlookSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="skeleton h-20 rounded-2xl" />
      <div className="skeleton h-56 rounded-2xl" />
    </div>
  )
}

export function OutlookError({ lang, onRetry }) {
  return (
    <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" aria-hidden /> {t(lang, 'outlookError')}</span>
      <button onClick={onRetry} className="press inline-flex items-center gap-1.5 border border-red-500/40 rounded-lg px-3 py-1.5 text-xs hover:bg-red-500/10 shrink-0">
        <RefreshCw size={13} aria-hidden /> {t(lang, 'retry')}
      </button>
    </div>
  )
}

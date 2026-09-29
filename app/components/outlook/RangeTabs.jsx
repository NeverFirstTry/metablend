import { t } from '@/lib/i18n'

export const RANGES = [['h48', 'tab48h'], ['d7', 'tab7d'], ['d14', 'tab14d']]

// 48 h · 7 days · 14 days — one range on screen at a time.
export default function RangeTabs({ value, onChange, lang }) {
  return (
    <div role="tablist" aria-label={t(lang, 'rangeLabel')} className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
      {RANGES.map(([id, key]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`press flex-1 text-xs sm:text-sm py-2 rounded-lg transition-colors ${value === id ? 'bg-emerald-400 text-black font-bold' : 'text-zinc-400 hover:text-emerald-400'}`}
        >
          {t(lang, key)}
        </button>
      ))}
    </div>
  )
}

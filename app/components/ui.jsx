'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Small shared building blocks for the forecast page and its tab views.

export function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-4 py-3 flex-1 min-w-[90px] transition-colors duration-200 hover:border-zinc-700">
      <div className="text-zinc-500 text-[0.6875rem] uppercase tracking-wider mb-1.5 flex items-center gap-1.5 min-w-0">
        {Icon && <Icon size={13} className="shrink-0" aria-hidden />}
        {/* long compounds (Nullgradgrenze) hyphenate in narrow cards; break-words catches the rest */}
        <span className="min-w-0 break-words hyphens-auto">{label}</span>
      </div>
      <div className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color }}>{sub}</div>}
    </div>
  )
}

// Section heading shared by every results card — icon + uppercase label, so
// the typographic hierarchy is identical everywhere.
export function SectionTitle({ icon: Icon, children, className = '' }) {
  return (
    <div className={`text-emerald-400 text-xs tracking-widest uppercase flex items-center gap-2 ${className}`}>
      {Icon && <Icon size={14} className="shrink-0" aria-hidden />}
      <span>{children}</span>
    </div>
  )
}

// A titled card whose body only mounts when opened — keeps heavy children
// (the radar map, the source cards) out of the first paint.
// A folded section. summary: one line under the title, shown while closed
// too (e.g. "20 sources · 92% agree"). storeKey: the viewer's last choice is
// kept (localStorage) — only for folds that render after the page has loaded,
// where there is no server HTML to match.
const readFold = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v === '1' } catch { return fallback }
}
export function Fold({ icon: Icon, title, summary = null, children, defaultOpen = false, storeKey = null }) {
  const [open, setOpen] = useState(() => (storeKey ? readFold(storeKey, defaultOpen) : defaultOpen))
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (storeKey) try { localStorage.setItem(storeKey, next ? '1' : '0') } catch { /* private mode */ }
  }
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm text-zinc-300 hover:text-emerald-400 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {Icon && <Icon size={15} className="shrink-0" aria-hidden />}
          <span className="min-w-0">
            {title}
            {summary && <span className="block text-xs text-zinc-500 mt-0.5 tabular-nums">{summary}</span>}
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div className="px-4 sm:px-5 pb-5 animate-fade-in">{children}</div>}
    </div>
  )
}

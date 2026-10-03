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
export function Fold({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm text-zinc-300 hover:text-emerald-400 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {Icon && <Icon size={15} className="shrink-0" aria-hidden />}
          <span className="min-w-0">{title}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div className="px-4 sm:px-5 pb-5 animate-fade-in">{children}</div>}
    </div>
  )
}

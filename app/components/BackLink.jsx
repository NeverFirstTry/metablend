import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// The way back at the top of a page: a 44 px high target (the text stays small) that names where it leads,
// "More", the peak's name, "Hiking" (UX review 2026-11-20, X1 and O1: it was a 20 px line of grey text saying
// "Back" or "All peaks", in the corner farthest from a right thumb). A link, or a button for a handler.
export default function BackLink({ href, onClick, className = '', children }) {
  const cls = `press inline-flex items-center gap-1.5 min-h-11 -ml-2 pl-2 pr-3 rounded-lg text-sm text-zinc-400 hover:text-emerald-400 transition-colors ${className}`
  const inner = <><ArrowLeft size={16} className="shrink-0" aria-hidden />{children}</>
  return onClick
    ? <button type="button" onClick={onClick} className={cls}>{inner}</button>
    : <Link href={href} className={cls}>{inner}</Link>
}

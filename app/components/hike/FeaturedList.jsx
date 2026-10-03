import Link from 'next/link'
import { MountainSnow, House } from 'lucide-react'

// Featured peaks as compact cards: linked in the app, plain on the teaser.
// Long names wrap instead of being cut off (the details column is wide on
// a phone: km · m · grade · country).
export default function FeaturedList({ peaks, hrefFor = null }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {peaks.map(p => {
        const Icon = p.kind === 'hut' ? House : MountainSnow
        const body = (
          <>
            <span className="inline-flex items-center gap-2 min-w-0">
              <Icon size={14} className="shrink-0 text-zinc-500" aria-hidden />
              <span className="min-w-0 break-words">{p.name}</span>
            </span>
            <span className="text-zinc-500 text-xs tabular-nums shrink-0">
              {[p.km != null ? `${Math.round(p.km)} km` : null, `${p.elev} m`, p.grade, p.country].filter(Boolean).join(' · ')}
            </span>
          </>
        )
        const cls = 'flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm'
        return hrefFor
          ? <Link key={p.id} href={hrefFor(p)} className={`${cls} hover:border-emerald-400 transition-colors`}>{body}</Link>
          : <div key={p.id} className={cls}>{body}</div>
      })}
    </div>
  )
}

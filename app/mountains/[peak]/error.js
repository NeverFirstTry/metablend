'use client'

import { startTransition, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CloudOff, RotateCcw } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { useLang } from '@/lib/useLang'

// A summit page whose forecast could not be had still answers 500 (crawlers retry, no empty page is
// kept), but shows the peak and the card the app's peak view shows for it, not "Something went wrong".
export default function SummitError({ reset }) {
  const lang = useLang()
  const router = useRouter()
  const { peak: id } = useParams()
  const [name, setName] = useState(null)
  // the peak list only when this card shows, not in every summit page's script
  useEffect(() => {
    import('@/lib/hike/featured.json').then(m => setName(m.default.find(p => p.id === id)?.name ?? null))
  }, [id])
  const retry = () => startTransition(() => { router.refresh(); reset() })

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6 flex flex-wrap gap-2">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span>/</span>
          <Link href="/mountains" className="hover:text-emerald-400">{t(lang, 'footerMountains')}</Link>
          {name && <><span>/</span><span className="text-zinc-400">{name}</span></>}
        </nav>
        {name && <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">{fill(t(lang, 'mtnPageTitle'), { name })}</h1>}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-400 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2"><CloudOff size={16} aria-hidden /> {t(lang, 'hikeError')}</span>
          <button type="button" onClick={retry} className="press inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-emerald-400 hover:text-emerald-400">
            <RotateCcw size={13} aria-hidden /> {t(lang, 'retry')}
          </button>
        </div>
      </div>
    </main>
  )
}

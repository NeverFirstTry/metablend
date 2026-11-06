'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function IcaoSearch() {
  const [q, setQ] = useState('')
  const router = useRouter()
  const go = () => {
    const icao = q.trim().toUpperCase()
    if (/^[A-Z]{4}$/.test(icao)) router.push(`/aviation/${icao.toLowerCase()}`)
  }
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors uppercase tracking-widest"
        placeholder="ICAO code… e.g. LOWW, EDDM, KJFK"
        value={q}
        maxLength={4}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') go() }}
        aria-label="Airport ICAO code"
      />
      <button
        onClick={go}
        aria-label="Search airport"
        className="press bg-emerald-400 text-black font-bold px-5 rounded-lg text-sm hover:bg-emerald-300 flex items-center justify-center"
      >
        <Search size={18} aria-hidden />
      </button>
    </div>
  )
}

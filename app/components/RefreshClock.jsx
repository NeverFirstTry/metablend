'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'

// The forecast toolbar's clock: "refreshes in m:ss" and how old the data is.
// Each ticks on its own, so the second hand redraws two spans — not the whole
// forecast page with its charts.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function Countdown({ at, lang }) {
  const ms = Math.max(0, at - useNow())
  return (
    <span className="text-zinc-500 text-[0.6875rem] tabular-nums">
      {t(lang, 'refreshesIn')} {Math.floor(ms / 60000)}:{String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}
    </span>
  )
}

// generatedAt: with the CDN in front, a fresh fetch can still return a copy
// computed up to 30 minutes ago, so this shows its real age
export function DataAge({ generatedAt, justUpdated, lang }) {
  const ageMin = Math.max(0, Math.floor((useNow() - Date.parse(generatedAt)) / 60000))
  return (
    <div className="text-[0.6875rem] mt-1 tabular-nums">
      {justUpdated ? (
        <span className="text-emerald-400 inline-flex items-center gap-1 animate-fade-in">
          <CheckCircle2 size={12} aria-hidden /> {t(lang, 'updatedJustNow')}
        </span>
      ) : (
        <span className="text-zinc-500">{ageMin < 1 ? t(lang, 'updatedJustNow') : fill(t(lang, 'updatedAgo'), { n: ageMin })}</span>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { t } from '@/lib/i18n'
import { noteVisit, toggleSaved, isSaved } from '@/lib/peak-shelf'

// The star beside a peak's name (UX review H2): keeps the peak in My peaks on the Hiking tab. Opening the
// peak also files it under Recently opened, with the forecast it showed (`d`, null while none came), so the
// row can say its window without a request of its own. Saved is a toggle: a neutral highlight, not gold.
export default function SavePeak({ peak, d, lang }) {
  const [saved, setSaved] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the phone's storage, after hydration
  useEffect(() => { setSaved(isSaved(noteVisit(peak, d), peak.id)) }, [peak, d])
  const label = t(lang, saved ? 'unsavePeak' : 'savePeak')
  return (
    <button type="button" onClick={() => setSaved(isSaved(toggleSaved(peak), peak.id))} aria-pressed={saved} aria-label={label} title={label}
      className={`press size-11 shrink-0 inline-flex items-center justify-center rounded-lg border ${saved ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100'}`}>
      <Star size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}

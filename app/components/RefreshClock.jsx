'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, WifiOff } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { keptAsOf } from '@/lib/kept-text'

// The forecast toolbar's clock: how old the data is. It ticks on its own, so the
// clock redraws one span — not the whole forecast page with its charts.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// generatedAt: with the CDN in front, a fresh fetch can still return a copy
// computed up to 30 minutes ago, so this shows its real age. The age is clock
// text: the start page is rendered on the server and cached, so the browser's
// first render says a later minute. suppressHydrationWarning keeps that from
// failing hydration (which rebuilt the page and dropped the theme and app marks);
// the next tick shows the right minute (lib/hydration.test.js).
// kept: the outlook is the place's last good answer from before an outage (lib/last-answer.js); the
// line then says when it was made, in the place's time, instead of counting minutes.
// offline: the last known forecast is shown, and this line says so in the warning colour, where the box above the page
// stood; that box pushed everything down, the rain prompt under the tab bar (owner, 2026-11-22)
export function DataAge({ generatedAt, justUpdated, lang, kept, utcOffsetSec, offline = false }) {
  const ageMin = Math.max(0, Math.floor((useNow() - Date.parse(generatedAt)) / 60000))
  // the icon inline in the text line, so the line is as high as the age it stands for (an inline-flex box was 2 px more)
  if (offline) return <div className="text-[0.6875rem] mt-1"><span role="status" className="text-[var(--warn)]"><WifiOff size={12} className="inline align-[-2px] mr-1" aria-hidden />{t(lang, 'offlineBanner')}</span></div>
  if (kept) return <div className="text-[0.6875rem] mt-1 tabular-nums"><span className="text-zinc-500">{keptAsOf(kept, utcOffsetSec, lang)}</span></div>
  return (
    <div className="text-[0.6875rem] mt-1 tabular-nums">
      {justUpdated ? (
        <span className="text-[var(--ok)] inline-flex items-center gap-1 animate-fade-in">
          <CheckCircle2 size={12} aria-hidden /> {t(lang, 'updatedJustNow')}
        </span>
      ) : (
        <span className="text-zinc-500" suppressHydrationWarning>{ageMin < 1 ? t(lang, 'updatedJustNow') : fill(t(lang, 'updatedAgo'), { n: ageMin })}</span>
      )}
    </div>
  )
}

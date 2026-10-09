'use client'

import { TriangleAlert } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { useWarnings } from '@/lib/warnings/useWarnings'
import { levelWord, levelIcons, typeWord, warningSpan, stripWarning, cardWarnings } from '@/lib/warnings/text'

const TONE = { 3: 'var(--hot)', 4: 'var(--bad)' }

// Orange and red only, on every forecast tab, above the temperature: one line
// that opens the "Official warnings" card (option C of the spec).
export default function WarningStrip({ lat, lon, cc, lang, todayLocal, onOpen }) {
  const data = useWarnings(lat, lon, lang, cc)
  const w = data ? stripWarning(data.warnings, data.at) : null
  if (!w) return null
  const more = cardWarnings(data.warnings, data.at).length - 1 // the others the card lists
  return (
    <button onClick={onOpen}
      className="press w-full text-left mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-zinc-900"
      style={{ borderColor: TONE[w.level], borderLeftWidth: 4 }}>
      <TriangleAlert size={16} style={{ color: TONE[w.level] }} className="shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-semibold" style={{ color: TONE[w.level] }}>{levelWord(lang, w.level)} <span aria-hidden>{levelIcons(w.level)}</span></span>
        {' · '}<span className="font-medium">{typeWord(lang, w.type)}</span>
        {' · '}<span className="text-zinc-400">{warningSpan(lang, w, todayLocal)}</span>
        {more > 0 && <span className="text-zinc-500"> · {fill(t(lang, 'warnMore'), { n: more })}</span>}
      </span>
    </button>
  )
}

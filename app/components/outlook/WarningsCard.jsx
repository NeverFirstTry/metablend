'use client'

import { useId, useState } from 'react'
import { TriangleAlert, ChevronDown } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { useWarnings } from '@/lib/warnings/useWarnings'
import { levelWord, levelHint, levelIcons, typeWord, warningSpan, cardWarnings } from '@/lib/warnings/text'
import { SectionTitle } from '../ui'

const TONE = { 2: 'var(--warn)', 3: 'var(--hot)', 4: 'var(--bad)' }

// Every official warning for the spot, now and in the next 48 h: level (word + ⚠
// count), type and time; a row opens the issuer's own text and advice.
export default function WarningsCard({ lat, lon, cc, lang, todayLocal }) {
  const data = useWarnings(lat, lon, lang, cc)
  const [open, setOpen] = useState(null)
  const base = useId()
  const list = data ? cardWarnings(data.warnings, data.at) : []
  if (!list.length) return null
  return (
    <section id="warnings" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1 scroll-mt-4" aria-label={t(lang, 'warnTitle')}>
      <SectionTitle icon={TriangleAlert}>{t(lang, 'warnTitle')}</SectionTitle>
      {list.map((w, i) => (
        <div key={w.id} className="border-t border-zinc-800 first-of-type:border-0">
          <button onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id} aria-controls={`${base}-${i}`}
            className="w-full flex items-start gap-3 py-2.5 text-left text-sm" title={t(lang, 'warnShow')}>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ color: TONE[w.level], borderColor: TONE[w.level] }}>
              {levelWord(lang, w.level)} <span aria-hidden>{levelIcons(w.level)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{typeWord(lang, w.type)}</span>
              <span className="block text-zinc-400 text-xs">{warningSpan(lang, w, todayLocal)} · {levelHint(lang, w.level)}</span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform ${open === w.id ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open === w.id && (
            <div id={`${base}-${i}`} className="pb-3 space-y-2 text-sm">
              {w.text.headline && <p className="font-medium">{w.text.headline}</p>}
              {w.text.description && <p className="text-zinc-300 whitespace-pre-line">{w.text.description}</p>}
              {w.text.instruction && (<><p className="text-xs text-zinc-500">{t(lang, 'warnAdvice')}</p><p className="text-zinc-300 whitespace-pre-line">{w.text.instruction}</p></>)}
              <p className="text-xs text-zinc-500">
                {w.web ? <a href={w.web} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline">{fill(t(lang, 'warnSource'), { sender: w.sender })}</a> : fill(t(lang, 'warnSource'), { sender: w.sender })}
              </p>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

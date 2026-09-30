'use client'

import { useEffect, useId, useState } from 'react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { SOURCE_NAMES } from '@/lib/sources'

const ALL_SOURCES = Object.entries(SOURCE_NAMES).filter(([id]) => id !== 'metablend').map(([, name]) => name)
const TICK_MS = 900 // matches the .ticker fade in globals.css

// The waiting moment: a cloud drifting past the sun while the sources are
// asked, one name at a time. `names` = the sources the request really asks
// ([] hides the ticker).
export default function SkyLoader({ lang, title, names = ALL_SOURCES, compact = false }) {
  const [i, setI] = useState(0)
  const glow = `glow${useId().replace(/[^\w-]/g, '')}` // url(#…) chokes on useId's punctuation
  useEffect(() => {
    if (names.length < 2) return
    const id = setInterval(() => setI(n => (n + 1) % names.length), TICK_MS)
    return () => clearInterval(id)
  }, [names.length])
  return (
    <div className={`mb-loader flex flex-col items-center text-center animate-fade-in ${compact ? 'py-6' : 'py-10 sm:py-14'}`}>
      <svg viewBox="0 0 160 110" width="176" height="121" aria-hidden>
        <g className="scene">
          <defs>
            <radialGradient id={glow}>
              <stop offset="0" style={{ stopColor: 'var(--loader-glow)', stopOpacity: 0.75 }} />
              <stop offset="1" style={{ stopColor: 'var(--loader-glow)', stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <g className="sun-glow"><circle cx="100" cy="42" r="38" fill={`url(#${glow})`} /></g>
          <g className="sun-rays" stroke="var(--loader-sun)" strokeWidth="3" strokeLinecap="round">
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
              <line key={a} x1="100" y1="16" x2="100" y2="21" transform={`rotate(${a} 100 42)`} />
            ))}
          </g>
          <circle cx="100" cy="42" r="15" fill="var(--loader-sun)" />
          <g className="cloud-back" fill="var(--loader-cloud)" style={{ opacity: 'var(--loader-shade)' }}>
            <circle cx="30" cy="42" r="10" /><circle cx="44" cy="35" r="13" /><circle cx="57" cy="43" r="9" />
            <rect x="20" y="42" width="46" height="11" rx="5.5" />
          </g>
          <g className="cloud-front" fill="var(--loader-cloud)">
            <circle cx="52" cy="70" r="20" /><circle cx="78" cy="60" r="26" /><circle cx="104" cy="74" r="16" />
            <rect x="32" y="70" width="88" height="22" rx="11" />
          </g>
        </g>
      </svg>
      <p role="status" className="mt-6 text-lg sm:text-xl font-semibold tracking-tight">{title}</p>
      {names.length > 0 && (
        <p key={i} aria-hidden className="ticker mt-1.5 text-sm text-zinc-400 tabular-nums">
          {fill(t(lang, 'loadingAsking'), { name: names[i % names.length] })}
        </p>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { t } from '@/lib/i18n'
import { EMBED_SIZES, embedCode, widgetPath } from '@/lib/share'

// "Embed": pick a size and a look, see the real widget, copy the code. The
// preview is the widget itself at its true size, scaled down to fit a phone.
export default function EmbedPanel({ city, lang, unit }) {
  const [size, setSize] = useState('compact')
  const [theme, setTheme] = useState('auto')
  const [copied, setCopied] = useState(false)
  const [scale, setScale] = useState(1)
  const box = useRef(null)
  const [w, h] = EMBED_SIZES[size]
  const code = embedCode({ city, lang, unit, theme, size })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / w))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked: the code stays selectable below */ }
  }

  const seg = (value, set, options) => (
    <div className="flex bg-zinc-800 rounded-lg p-0.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => set(v)} aria-pressed={value === v}
          className={`press flex-1 rounded-md px-3 py-1.5 text-xs ${value === v ? 'bg-emerald-400 text-black font-semibold' : 'text-zinc-400 hover:text-emerald-400'}`}>
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in">
      <div>
        <div className="font-semibold tracking-tight">{t(lang, 'embedTitle')}</div>
        <div className="text-xs text-zinc-400 mt-0.5">{t(lang, 'embedHint')}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="space-y-1.5 block"><span className="text-xs text-zinc-500">{t(lang, 'embedSize')}</span>
          {seg(size, setSize, [['compact', `${t(lang, 'embedCompact')} · 300×200`], ['wide', `${t(lang, 'embedWide')} · 480×180`]])}
        </label>
        <label className="space-y-1.5 block"><span className="text-xs text-zinc-500">{t(lang, 'themeLabel')}</span>
          {seg(theme, setTheme, [['auto', t(lang, 'themeSystemName')], ['dark', t(lang, 'themeDarkName')], ['light', t(lang, 'themeLightName')]])}
        </label>
      </div>
      <div ref={box} className="flex justify-center" style={{ height: h * scale }}>
        <iframe key={`${size}-${theme}`} src={widgetPath({ city, lang, unit, theme })} width={w} height={h}
          title={`MetaBlend · ${city}`} loading="lazy"
          style={{ border: 0, borderRadius: 16, transform: `scale(${scale})`, transformOrigin: 'top center', flexShrink: 0, boxShadow: '0 12px 32px -16px rgb(0 0 0 / 0.5)' }} />
      </div>
      <pre className="font-mono text-[0.6875rem] leading-relaxed bg-zinc-950 border border-zinc-800 rounded-xl p-3 whitespace-pre-wrap break-all text-zinc-300 select-all">{code}</pre>
      <button onClick={copy} className="press inline-flex items-center gap-1.5 bg-emerald-400 text-black text-sm font-semibold px-4 py-2 rounded-full hover:bg-emerald-300">
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? t(lang, 'copied') : t(lang, 'embedCopy')}
      </button>
    </div>
  )
}

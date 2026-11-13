'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { t } from '@/lib/i18n'

// The 28-second film in the consensus explainer (owner 2026-11-13): German for German readers, English for
// everyone else; square on a phone, 16:9 from 640 px. No file loads until the film is in view, and then only the
// one that fits, so a phone never fetches the wide film. Muted and looped; with reduced motion it waits on its
// poster for the play button. The pause button is there for everyone: a moving picture that runs longer than five
// seconds needs one (WCAG 2.2.2).
const WIDE = '(min-width: 640px)'

export default function PromoVideo({ lang }) {
  const film = shape => `/promo/metablend-${shape}-${lang === 'de' ? 'de' : 'en'}` // + .webm, .mp4, -poster.webp
  const ref = useRef(null)
  const inView = useRef(false)
  const choice = useRef(null) // the visitor's play or pause; null: play while in view, unless motion is reduced
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)

  function sync() {
    const video = ref.current
    if (!video) return
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!(inView.current && (choice.current ?? !calm))) return video.pause()
    // shortcut: the shape is picked once, at the first play; a phone turned afterwards keeps it, cropped to fit
    const shape = video.dataset.shape || (video.dataset.shape = matchMedia(WIDE).matches ? '16x9' : '1x1')
    const src = film(shape) + (video.canPlayType('video/webm; codecs="vp9"') ? '.webm' : '.mp4')
    if (!video.src.endsWith(src)) video.src = src // the language comes from the cookie after the first render
    video.play().catch(() => {}) // a browser that refuses to play muted keeps the poster and the play button
  }

  // again when the language changes: sync has to see the current one
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; sync() }, { threshold: 0.5 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps -- sync reads refs and lang only

  const toggle = () => { choice.current = !playing; sync() }

  return (
    <div className="web-only relative mb-4 aspect-square sm:aspect-video overflow-hidden rounded-xl bg-[#0f151b]">
      <picture>
        <source media={WIDE} srcSet={`${film('16x9')}-poster.webp`} />
        <img src={`${film('1x1')}-poster.webp`} alt="" className="absolute inset-0 w-full h-full object-cover" />
      </picture>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        aria-label={t(lang, 'promoLabel')}
        onLoadedData={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ${ready ? '' : 'opacity-0'}`}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={t(lang, playing ? 'promoPause' : 'promoPlay')}
        // one place for both states, clear of the film's numbers; colours fixed, since the film is dark in both themes
        className="press absolute right-3 bottom-3 w-12 h-12 rounded-full flex items-center justify-center"
        style={playing ? { background: 'rgba(15,21,27,0.7)', color: '#f6f8fc' } : { background: 'var(--accent)', color: '#0f151b' }}
      >
        {playing ? <Pause size={18} aria-hidden /> : <Play size={26} className="translate-x-0.5" aria-hidden />}
      </button>
    </div>
  )
}

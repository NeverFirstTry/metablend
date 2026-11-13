'use client'

import { Download } from 'lucide-react'
import { useLang } from '@/lib/useLang'
import { pressFor, PRESS_KIT } from '@/lib/press'
import { STORES } from '@/lib/hike/stores'
import Footer from '../components/Footer'

const EMAIL = 'info@metablend.app'
const heading = 'text-emerald-400 text-xs uppercase tracking-widest'
const link = 'text-emerald-400 hover:underline'
// the logos as the press kit has them, each on the background it is made for
const PREVIEWS = [
  ['/press/metablend-wordmark-dark.svg', '#0f151b', 'previewDark'],
  ['/press/metablend-wordmark-light.svg', '#ffffff', 'previewLight'],
  ['/press/metablend-mark-dark.svg', '#0f151b', 'previewDark'],
  ['/press/metablend-app-icon.png', null, 'previewIcon'],
]

// The press page, English and German (lib/press.js): what MetaBlend is, key facts, contact, the stores
// (from lib/hike/stores.js once they are set) and the press kit.
export default function PressContent({ kitBytes }) {
  const lang = useLang()
  const p = pressFor(lang)
  const size = `${(kitBytes / 1e6).toLocaleString(lang === 'de' ? 'de' : 'en', { maximumFractionDigits: 1 })} MB`
  const stores = [['App Store', STORES.ios], ['Google Play', STORES.android]].filter(([, url]) => url)

  return (
    <main className="max-w-2xl mx-auto w-full px-4 py-8 sm:py-12 space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{p.title}</h1>
        <p className="text-zinc-300 leading-relaxed">{p.intro}</p>
      </div>

      <section className="space-y-3">
        <h2 className={heading}>{p.factsTitle}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {p.facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-zinc-500">{term}</dt>
              <dd className="text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className={heading}>{p.contactTitle}</h2>
        <p className="text-lg"><a href={`mailto:${EMAIL}`} className={link}>{EMAIL}</a></p>
      </section>

      <section className="space-y-2">
        <h2 className={heading}>{p.storesTitle}</h2>
        {stores.length
          ? <p className="flex flex-wrap gap-x-5 gap-y-1">{stores.map(([name, url]) => <a key={name} href={url} className={link}>{name}</a>)}</p>
          : <p className="text-sm text-zinc-300 leading-relaxed">{p.storesSoon}</p>}
      </section>

      {/* the two 16:9 films as they go to the stores; in the kit too (scripts/brand/press-kit.mjs) */}
      <section className="space-y-4">
        <h2 className={heading}>{p.videoTitle}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {p.videos.map(([src, poster, text]) => (
            <figure key={src} className="space-y-2">
              <video src={src} poster={poster} controls muted playsInline preload="none" className="w-full aspect-video rounded-xl border border-zinc-800 bg-[#0f151b]" />
              <figcaption className="text-sm text-zinc-300 leading-relaxed">
                {text} <a href={src} download className={link}>{p.videoDownload}</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={heading}>{p.kitTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PREVIEWS.map(([src, bg, label]) => (
            <figure key={src} className="space-y-1.5">
              <div className="aspect-square rounded-xl border border-zinc-800 flex items-center justify-center p-4" style={bg ? { background: bg } : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element -- small static previews of the files in the kit */}
                <img src={src} alt="" className={bg ? 'w-full h-auto' : 'w-full h-auto rounded-[22%] ring-1 ring-white/20'} />
              </div>
              <figcaption className="text-xs text-zinc-500">{p[label]}</figcaption>
            </figure>
          ))}
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{p.kitText.replace('{size}', size)}</p>
        <ul className="text-sm text-zinc-300 leading-relaxed list-disc pl-5 space-y-1">
          {p.kitItems.map(item => <li key={item}>{item}</li>)}
        </ul>
        <a href={PRESS_KIT} download className="press inline-flex items-center gap-2 bg-emerald-400 text-black font-semibold rounded-full px-5 py-2.5 text-sm hover:bg-emerald-300">
          <Download size={16} aria-hidden /> {p.kitButton}
        </a>
      </section>

      <Footer lang={lang} />
    </main>
  )
}

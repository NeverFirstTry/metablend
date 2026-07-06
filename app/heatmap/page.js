'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { loadLeaflet } from '@/lib/leaflet'
import { t } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import BetaBanner from '../components/BetaBanner'
import Footer from '../components/Footer'

function accuracyColor(a) {
  if (a == null) return '#71717a' // unknown
  if (a >= 0.7) return '#34d399'  // good
  if (a >= 0.4) return '#fbbf24'  // meh
  return '#f87171'                // off
}

export default function Heatmap() {
  const lang = useLang()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(null)
  const [points, setPoints] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/heatmap')
      .then(r => r.json())
      .then(d => setPoints(d.points ?? []))
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!points) return
    let cancelled = false

    loadLeaflet().then((L) => {
      if (cancelled || !L || !containerRef.current) return

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [20, 0],
          zoom: 2,
          worldCopyJump: true,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapRef.current)
      }

      // markers live in a clearable group so a language change re-renders
      // the popups instead of stacking duplicate pins
      if (!markersRef.current) markersRef.current = L.layerGroup().addTo(mapRef.current)
      markersRef.current.clearLayers()

      points.forEach(p => {
        const color = accuracyColor(p.accuracy)
        L.circleMarker([p.lat, p.lon], {
          radius: 7,
          color,
          fillColor: color,
          fillOpacity: 0.7,
          weight: 1,
        })
          .bindPopup(
            `<b>${p.city ?? t(lang, 'hmUnknown')}</b><br/>` +
            (p.accuracy != null
              ? `${t(lang, 'hmAccuracy')}: ${Math.round(p.accuracy * 100)}%`
              : `${t(lang, 'hmAccuracy')}: n/a`) +
            (p.temp != null ? `<br/>${t(lang, 'hmReported')}: ${p.temp}°C` : '')
          )
          .addTo(markersRef.current)
      })

      setTimeout(() => mapRef.current?.invalidateSize(), 100)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [points, lang])

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
  }, [])

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
        </Link>

        <h1 className="text-3xl font-bold mb-1">
          Feedback<span className="text-emerald-400">Heatmap</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          {t(lang, 'hmSubtitle')}
        </p>

        <BetaBanner lang={lang} className="mb-6" />

        {error && (
          <div className="animate-scale-in bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden /> {error}
          </div>
        )}

        <div
          ref={containerRef}
          className="w-full h-[60vh] rounded-2xl overflow-hidden border border-zinc-800 z-0"
          style={{ background: 'var(--map-bg)' }}
        />

        {/* legend dots keep the marker hexes — they must match the map pins */}
        <div className="flex gap-4 mt-4 text-xs text-zinc-400 flex-wrap">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#34d399' }} /> {t(lang, 'hmAccurate')} (≥70%)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#fbbf24' }} /> {t(lang, 'hmMixed')} (40–70%)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#f87171' }} /> {t(lang, 'hmOff')} (&lt;40%)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#71717a' }} /> {t(lang, 'hmUnknown')}</span>
        </div>

        {points && points.length === 0 && !error && (
          <p className="text-zinc-500 text-sm mt-4">
            {t(lang, 'hmEmpty')}
          </p>
        )}

        <Footer lang={lang} />
      </div>
    </main>
  )
}

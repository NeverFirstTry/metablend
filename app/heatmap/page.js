'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { loadLeaflet } from '@/lib/leaflet'
import BetaBanner from '../components/BetaBanner'
import Footer from '../components/Footer'

function accuracyColor(a) {
  if (a == null) return '#71717a' // unknown
  if (a >= 0.7) return '#34d399'  // good
  if (a >= 0.4) return '#fbbf24'  // meh
  return '#f87171'                // off
}

export default function Heatmap() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
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
            `<b>${p.city ?? 'Unknown'}</b><br/>` +
            (p.accuracy != null ? `Accuracy: ${Math.round(p.accuracy * 100)}%` : 'Accuracy: n/a') +
            (p.temp != null ? `<br/>Reported: ${p.temp}°C` : '')
          )
          .addTo(mapRef.current)
      })

      setTimeout(() => mapRef.current?.invalidateSize(), 100)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [points])

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
  }, [])

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft size={15} aria-hidden /> Back
        </Link>

        <h1 className="text-3xl font-bold mb-1">
          Feedback<span className="text-emerald-400">Heatmap</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          Where the consensus was right — and wrong
        </p>

        <BetaBanner className="mb-6" />

        {error && (
          <div className="animate-scale-in bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden /> {error}
          </div>
        )}

        <div
          ref={containerRef}
          className="w-full h-[60vh] rounded-2xl overflow-hidden border border-zinc-800 z-0"
          style={{ background: '#0a0a0d' }}
        />

        <div className="flex gap-4 mt-4 text-xs text-zinc-400 flex-wrap">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#34d399' }} /> Accurate (≥70%)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#fbbf24' }} /> Mixed (40–70%)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#f87171' }} /> Off (&lt;40%)</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#71717a' }} /> Unknown</span>
        </div>

        {points && points.length === 0 && !error && (
          <p className="text-zinc-500 text-sm mt-4">
            No geolocated feedback yet. Submit feedback from the home page to populate the map.
          </p>
        )}

        <Footer />
      </div>
    </main>
  )
}

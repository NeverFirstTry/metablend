'use client'

import { useEffect, useRef } from 'react'
import { CloudRain } from 'lucide-react'
import { loadLeaflet } from '@/lib/leaflet'

// RainViewer radar laid over an OpenStreetMap base.
export default function RainRadar({ lat, lon, title = 'Rain Radar' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const radarLayerRef = useRef(null)

  useEffect(() => {
    if (lat == null || lon == null) return
    let cancelled = false

    loadLeaflet().then(async (L) => {
      if (cancelled || !L || !containerRef.current) return

      // build the map the first time, just recenter after that
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [lat, lon],
          zoom: 7,
          attributionControl: true,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          className: 'osm-dark',
        }).addTo(mapRef.current)
        L.marker([lat, lon]).addTo(mapRef.current)
      } else {
        mapRef.current.setView([lat, lon], 7)
      }

      // grab the most recent radar frame and drop it on top
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const data = await res.json()
        const frames = data.radar?.past ?? []
        const last = frames[frames.length - 1]
        if (last && mapRef.current) {
          const host = data.host ?? 'https://tilecache.rainviewer.com'
          const tileUrl = `${host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`
          if (radarLayerRef.current) mapRef.current.removeLayer(radarLayerRef.current)
          radarLayerRef.current = L.tileLayer(tileUrl, { opacity: 0.6, zIndex: 10 })
          radarLayerRef.current.addTo(mapRef.current)
        }
      } catch {} // no radar is fine, the map still shows

      setTimeout(() => mapRef.current?.invalidateSize(), 100)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [lat, lon])

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
  }, [])

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8">
      <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4 flex items-center gap-2">
        <CloudRain size={14} aria-hidden /> {title}
      </div>
      <div
        ref={containerRef}
        className="w-full h-64 sm:h-80 rounded-xl overflow-hidden z-0"
        style={{ background: '#0a0a0d' }}
      />
      <div className="text-zinc-600 text-xs mt-3">
        Radar: RainViewer · Map: OpenStreetMap
      </div>
    </div>
  )
}

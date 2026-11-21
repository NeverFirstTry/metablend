'use client'

import { useEffect, useRef, useState } from 'react'
import { CloudRain } from 'lucide-react'
import { loadLeaflet } from '@/lib/leaflet'
import { useLang } from '@/lib/useLang'
import { radarLegend, radarTime } from '@/lib/radar'

// RainViewer radar laid over an OpenStreetMap base. `bare` drops the card
// chrome for use inside a Fold, which already provides title and border.
// The map is drawn in the theme (UX review D1): no Leaflet credit box (the line under the map credits RainViewer
// and OpenStreetMap once), the theme's zoom buttons (globals.css), a plain dot for the place. The picture says
// from when it is and what its colours mean (D2).
export default function RainRadar({ lat, lon, title = 'Rain Radar', bare = false }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const radarLayerRef = useRef(null)
  const [frameAt, setFrameAt] = useState(null)
  const lang = useLang()

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
          attributionControl: false,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          className: 'osm-dark',
        }).addTo(mapRef.current)
        L.circleMarker([lat, lon], { radius: 7, weight: 3, fillOpacity: 1, className: 'radar-place' }).addTo(mapRef.current)
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
          if (!cancelled) setFrameAt(last.time)
        }
      } catch {} // no radar is fine, the map still shows

      setTimeout(() => mapRef.current?.invalidateSize(), 100)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [lat, lon])

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
  }, [])

  const map = (
    <>
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full h-64 sm:h-80 rounded-xl overflow-hidden z-0"
          style={{ background: 'var(--map-bg)' }}
        />
        {frameAt && <span className="absolute left-2 bottom-2 z-[500] rounded-md px-2 py-1 text-xs tabular-nums" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>{radarTime(lang, frameAt)}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mt-3">
        {radarLegend(lang).map(x => <span key={x.color} className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block w-3 h-3 rounded-sm" style={{ background: x.color, opacity: 0.6 }} />{x.label}</span>)}
      </div>
      <div className="text-zinc-500 text-xs mt-3">
        Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">Weather data by RainViewer</a> · Map: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">© OpenStreetMap contributors</a>
      </div>
    </>
  )
  if (bare) return <div>{map}</div>

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-8">
      <div className="text-emerald-400 text-xs tracking-widest uppercase mb-4 flex items-center gap-2">
        <CloudRain size={14} aria-hidden /> {title}
      </div>
      {map}
    </div>
  )
}

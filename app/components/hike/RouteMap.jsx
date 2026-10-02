'use client'

import { useEffect, useRef } from 'react'
import { loadLeaflet } from '@/lib/leaflet'

const TOPO = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

// The route on a topographic map: the line, start (green), the highest point
// (white) and the end (red). OpenTopoMap first; its first tile error switches
// to the standard OSM tiles.
export default function RouteMap({ points, highIndex }) {
  const box = useRef(null), map = useRef(null)

  useEffect(() => {
    let gone = false
    loadLeaflet().then(L => {
      if (gone || !L || !box.current || !points?.length) return
      map.current ??= L.map(box.current, { zoomControl: false, scrollWheelZoom: false })
      const m = map.current
      m.eachLayer(l => m.removeLayer(l))
      const topo = L.tileLayer(TOPO, { maxZoom: 17, subdomains: 'abc', attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors' })
      let fell = false
      topo.on('tileerror', () => {
        if (fell) return
        fell = true
        m.removeLayer(topo)
        L.tileLayer(OSM, { maxZoom: 19, subdomains: 'abc', attribution: '© OpenStreetMap contributors' }).addTo(m)
      })
      topo.addTo(m)
      const ll = points.map(p => [p[0], p[1]])
      const line = L.polyline(ll, { color: '#ffd98a', weight: 4, opacity: 0.95 }).addTo(m)
      const dot = (at, fill) => L.circleMarker(at, { radius: 6, color: '#0f1b33', weight: 2, fillColor: fill, fillOpacity: 1 }).addTo(m)
      dot(ll[0], '#8eecc4')
      dot(ll.at(-1), '#ff9a9a')
      if (highIndex != null && ll[highIndex]) dot(ll[highIndex], '#ffffff')
      m.fitBounds(line.getBounds(), { padding: [24, 24] })
    })
    return () => { gone = true }
  }, [points, highIndex])

  useEffect(() => () => { map.current?.remove(); map.current = null }, [])

  return <div ref={box} className="h-64 sm:h-80 rounded-2xl overflow-hidden border border-zinc-800" role="img" aria-label="Route map" />
}

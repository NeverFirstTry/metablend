'use client'

import { useEffect, useRef, useState } from 'react'
import { loadLeaflet } from '@/lib/leaflet'

const TOPO = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

// The route on a topographic map: the line, start (green), the highest point
// (white) and the end (red). OpenTopoMap first; its first tile error switches
// to the standard OSM tiles. The credit stands in a line under the map (UX review O2: inside it, three lines
// of links covered a fifth of the map and the route's start); it names the layer that is shown.
const A = { target: '_blank', rel: 'noopener noreferrer', className: 'underline underline-offset-2 hover:text-emerald-400' }
export default function RouteMap({ points, highIndex }) {
  const box = useRef(null), map = useRef(null)
  const [osm, setOsm] = useState(false) // the OpenTopoMap tiles failed: the standard OSM tiles are shown

  useEffect(() => {
    let gone = false
    loadLeaflet().then(L => {
      if (gone || !L || !box.current || !points?.length) return
      map.current ??= L.map(box.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: false })
      const m = map.current
      m.eachLayer(l => m.removeLayer(l))
      const topo = L.tileLayer(TOPO, { maxZoom: 17, subdomains: 'abc' })
      let fell = false
      topo.on('tileerror', () => {
        if (fell) return
        fell = true
        m.removeLayer(topo)
        L.tileLayer(OSM, { maxZoom: 19, subdomains: 'abc' }).addTo(m)
        if (!gone) setOsm(true)
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

  return (
    <div>
      <div ref={box} className="h-64 sm:h-80 rounded-2xl overflow-hidden border border-zinc-800" role="img" aria-label="Route map" />
      <p className="mt-1.5 px-1 text-xs text-zinc-500">
        <a href="https://leafletjs.com" {...A}>Leaflet</a>
        {osm
          ? <> · © <a href="https://www.openstreetmap.org/copyright" {...A}>OpenStreetMap</a> contributors</>
          : <> · Map data: © <a href="https://www.openstreetmap.org/copyright" {...A}>OpenStreetMap</a> contributors, SRTM · Map style: © <a href="https://opentopomap.org" {...A}>OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" {...A}>CC-BY-SA</a>)</>}
      </p>
    </div>
  )
}

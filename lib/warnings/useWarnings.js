'use client'

import { useEffect, useState } from 'react'

// The warnings at a spot, for the strip and the card at once (one fetch per
// ~1 km cell and language, shared, refreshed every 10 minutes). `at` is when
// they were last loaded or re-checked — the "now" the strip judges them by
// (render code must not read the clock).
const cache = new Map() // key → { at, data, req }
const round = v => Math.round(v * 100) / 100

export function useWarnings(lat, lon, lang) {
  const key = Number.isFinite(lat) && Number.isFinite(lon) ? `${round(lat)},${round(lon)},${lang}` : null
  const [state, setState] = useState(() => {
    const hit = key ? cache.get(key) : null
    return hit?.data ? { d: hit.data, at: hit.at } : null
  })
  useEffect(() => {
    if (!key) return
    let off = false
    const load = () => {
      const hit = cache.get(key)
      if (hit?.data && Date.now() - hit.at < 10 * 60e3) { setState({ d: hit.data, at: Date.now() }); return }
      const [la, lo, lg] = key.split(',')
      const req = hit?.req ?? fetch(`/api/warnings?lat=${la}&lon=${lo}&lang=${lg}`).then(r => (r.ok ? r.json() : null), () => null)
      cache.set(key, { ...hit, req })
      req.then(d => { cache.set(key, { at: Date.now(), data: d, req: null }); if (!off) setState({ d, at: Date.now() }) })
    }
    load()
    const id = setInterval(load, 10 * 60e3)
    return () => { off = true; clearInterval(id) }
  }, [key])
  return state?.d ? { ...state.d, at: state.at } : null
}

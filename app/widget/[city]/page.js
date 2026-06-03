'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// Minimal consensus card built for a 300x200 iframe embed.
export default function Widget() {
  const params = useParams()
  const city = decodeURIComponent(params.city ?? '')
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!city) return
    fetch(`/api/forecast?city=${encodeURIComponent(city)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(true); else setData(d) })
      .catch(() => setError(true))
  }, [city])

  const condition =
    data?.sources?.find(s => s.apiId === 'open-meteo')?.condition ??
    data?.sources?.[0]?.condition ?? ''

  const conf = data?.consensus?.confidencePct ?? 0
  const confColor = conf >= 70 ? '#34d399' : conf >= 45 ? '#fbbf24' : '#f87171'

  return (
    <div style={{
      width: '100%', height: '100vh', background: '#0e0e12', color: '#fff',
      fontFamily: 'monospace', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', padding: '14px 16px', boxSizing: 'border-box',
    }}>
      {error ? (
        <div style={{ color: '#f87171', fontSize: 13 }}>Could not load weather for “{city}”.</div>
      ) : !data ? (
        <div style={{ color: '#71717a', fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            {data.city}{data.country ? `, ${data.country}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1 }}>{data.consensus.temp}°</div>
            <div style={{ fontSize: 13, color: '#a1a1aa' }}>{condition}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: confColor }}>{conf}% consensus</span>
            <span style={{ color: '#71717a' }}>
              Meta<span style={{ color: '#34d399' }}>Blend</span>
            </span>
          </div>
        </>
      )}
    </div>
  )
}

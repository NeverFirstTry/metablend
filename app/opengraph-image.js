import { ImageResponse } from 'next/og'

// Branded 1200×630 social-share card, generated at the edge (no static asset to
// keep in sync). Next wires this into <meta property="og:image"> automatically.
export const alt = 'MetaBlend — weather truth through consensus'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#0e0e12',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: '#34d399',
          }}
        >
          Weather · Consensus
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 128, letterSpacing: -3 }}>
            <span>Meta</span>
            <span style={{ color: '#34d399' }}>Blend</span>
          </div>
          <div style={{ display: 'flex', fontSize: 46, color: '#a1a1aa', marginTop: 18 }}>
            Weather truth through consensus.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 28,
            color: '#71717a',
          }}
        >
          <div style={{ display: 'flex' }}>10+ forecasts, weighted by accuracy</div>
          <div style={{ display: 'flex', color: '#34d399' }}>metablend-beta.vercel.app</div>
        </div>
      </div>
    ),
    { ...size }
  )
}

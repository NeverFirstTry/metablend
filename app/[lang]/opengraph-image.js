import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { t } from '@/lib/i18n'
import { LANDING_LANGS } from '@/lib/landing'

// The share image of /de, /fr ...: built once per language in the build, never per visit.
export const alt = 'MetaBlend'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamicParams = false
export function generateStaticParams() { return LANDING_LANGS.map(lang => ({ lang })) }

const font = (name, file) => readFile(join(process.cwd(), 'lib/og-fonts', file)).then(data => ({ name, data, weight: 500, style: 'normal' }))

export default async function OpengraphImage({ params }) {
  const { lang } = await params
  const fonts = [await font('Hanken Grotesk', 'latin.ttf')]
  if (['ja', 'zh', 'ko'].includes(lang)) fonts.push(await font('Noto Sans', `${lang}.ttf`))
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
          background: '#0b1022',
          color: '#ffffff',
          fontFamily: fonts.map(f => f.name).join(', '),
        }}
      >
        <div style={{ display: 'flex', fontSize: 104, letterSpacing: -3 }}>
          <span>Meta</span>
          <span style={{ color: '#ffd98a' }}>Blend</span>
        </div>
        <div style={{ display: 'flex', fontSize: 52, lineHeight: 1.25, maxWidth: 1040 }}>{t(lang, 'homeLead')}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28, color: '#aab3c2' }}>
          <div style={{ display: 'flex' }}>{t(lang, 'landingFree')}</div>
          <div style={{ display: 'flex', color: '#ffd98a' }}>metablend.app</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}

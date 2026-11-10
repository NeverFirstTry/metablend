import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { t } from '@/lib/i18n'
import { OG, ogBackground } from '@/lib/og-look'

// The fonts are cut down to the characters on these cards (scripts/brand/og-fonts.mjs, lib/og-card.js)
const font = (name, file) => readFile(join(process.cwd(), 'lib/og-fonts', file)).then(data => ({ name, data, weight: 500, style: 'normal' }))

// The share card of the start page (English) and of /de, /fr ...: the wordmark, the lead sentence in the
// page's language, free / no ads / no account and the address, on Slate with the midday glow.
export async function landingCard(lang) {
  const fonts = [await font('Hanken Grotesk', 'latin.ttf')]
  if (['ja', 'zh', 'ko'].includes(lang)) fonts.push(await font('Noto Sans', `${lang}.ttf`))
  const element = (
    <div
      style={{
        height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '72px 80px', color: OG.ink, fontFamily: fonts.map(f => f.name).join(', '), ...ogBackground('day'),
      }}
    >
      <div style={{ display: 'flex', fontSize: 104, letterSpacing: -3 }}>
        <span>Meta</span>
        <span style={{ color: OG.gold }}>Blend</span>
      </div>
      <div style={{ display: 'flex', fontSize: 52, lineHeight: 1.25, maxWidth: 1040, wordBreak: 'keep-all' }}>{t(lang, 'homeLead')}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28, color: OG.muted }}>
        <div style={{ display: 'flex' }}>{t(lang, 'landingFree')}</div>
        <div style={{ display: 'flex', color: OG.gold }}>metablend.app</div>
      </div>
    </div>
  )
  return { element, fonts }
}

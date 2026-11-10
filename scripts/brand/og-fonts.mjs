// node scripts/brand/og-fonts.mjs: the fonts of the /de, /fr ... share images, cut down to the
// characters on them, into lib/og-fonts/. Run it again after changing those texts (a test says when).
// Hanken Grotesk and Noto Sans JP, SC and KR, from Google Fonts, under the SIL Open Font License.
import { writeFileSync, mkdirSync } from 'node:fs'
import { t, LANGUAGES } from '../../lib/i18n.js'
import { ogText, OG_BRAND } from '../../lib/og-card.js'

const FAMILIES = { latin: 'Hanken Grotesk', ja: 'Noto Sans JP', zh: 'Noto Sans SC', ko: 'Noto Sans KR' }
const out = new URL('../../lib/og-fonts/', import.meta.url)
mkdirSync(out, { recursive: true })

const textOf = lang => ogText(key => t(lang, key))
const need = { latin: new Set(OG_BRAND), ja: new Set(), zh: new Set(), ko: new Set() }
for (const { code } of LANGUAGES) {
  for (const ch of textOf(code)) need[need[code] ? code : 'latin'].add(ch)
}

const glyphs = {}
for (const [name, family] of Object.entries(FAMILIES)) {
  const text = [...need[name]].sort().join('')
  // without a browser's user agent, Google answers with a plain TrueType file
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@500&text=${encodeURIComponent(text)}`)).text()
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/)?.[1]
  if (!url) throw new Error(`no TrueType file for ${family}: ${css.slice(0, 200)}`)
  const font = Buffer.from(await (await fetch(url)).arrayBuffer())
  writeFileSync(new URL(`${name}.ttf`, out), font)
  glyphs[name] = text
  console.log(`${name}.ttf: ${[...text].length} characters, ${(font.length / 1024).toFixed(1)} KB`)
}
writeFileSync(new URL('glyphs.json', out), `${JSON.stringify(glyphs, null, 2)}\n`)

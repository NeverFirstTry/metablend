// The MetaBlend wordmark as outlines: "Meta" and "Blend" in Hanken Grotesk Bold (700) with the site logo's
// tight tracking (-0.025em, .site-logo tracking-tight), so it draws the same without the font. Two paths, one
// per part, in a viewBox cut to the letters. Needs: npm i --no-save opentype.js @fontsource/hanken-grotesk
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const opentype = require('opentype.js')

const buf = fs.readFileSync(require.resolve('@fontsource/hanken-grotesk/files/hanken-grotesk-latin-700-normal.woff'))
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const SIZE = 100, TRACK = -0.025 * SIZE

// one run of letters from x, kerned and tracked; returns its path and the x after it
function run(text, x, y) {
  const path = new opentype.Path(), k = SIZE / font.unitsPerEm
  // letter by letter: opentype.js cannot run this font's substitution tables, and the name has no ligature
  const glyphs = [...text].map(c => font.charToGlyph(c))
  glyphs.forEach((g, i) => {
    path.extend(g.getPath(x, y, SIZE))
    x += g.advanceWidth * k + TRACK + (glyphs[i + 1] ? font.getKerningValue(g, glyphs[i + 1]) * k : 0)
  })
  return [path, x]
}

// the path data written from the commands: opentype.js 2.0's toPathData prints NaN for some control points
// whose commands are fine, and a renderer then drops whole letters (the t, a and d went missing)
const n = v => +v.toFixed(1)
const pathData = p => p.commands.map(c => c.type === 'Z' ? 'Z'
  : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
  : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
  : `${c.type}${n(c.x)} ${n(c.y)}`).join('')

// colours: dark backgrounds take ink and sunlight gold, light ones Slate ink and the deep gold
export const WORDMARK = { dark: { meta: '#f6f8fc', blend: '#ffd98a' }, light: { meta: '#141c2b', blend: '#966400' } }

export function wordmarkSVG({ meta, blend } = WORDMARK.dark, { width, pad = 0 } = {}) {
  const [m, x] = run('Meta', 0, SIZE)
  // the kerning across the two parts, as in one word
  const [b] = run('Blend', x + font.getKerningValue(font.charToGlyph('a'), font.charToGlyph('B')) * SIZE / font.unitsPerEm, SIZE)
  const bm = m.getBoundingBox(), bb = b.getBoundingBox()
  const x1 = Math.min(bm.x1, bb.x1) - pad, y1 = Math.min(bm.y1, bb.y1) - pad, x2 = Math.max(bm.x2, bb.x2) + pad, y2 = Math.max(bm.y2, bb.y2) + pad
  const w = +(x2 - x1).toFixed(2), h = +(y2 - y1).toFixed(2)
  const dims = width ? ` width="${width}" height="${Math.round(width * h / w)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1.toFixed(2)} ${y1.toFixed(2)} ${w} ${h}"${dims}><path fill="${meta}" d="${pathData(m)}"/><path fill="${blend}" d="${pathData(b)}"/></svg>`
}

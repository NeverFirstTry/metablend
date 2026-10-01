// MetaBlend mark: "M" + "B" from Hanken Grotesk ExtraBold (the site's brand
// face) as real outlines, centred exactly on their own outline, with two
// simple clouds behind them. 100×100 viewBox, no masks (renders the same in
// every browser and rasteriser).
//
// Regenerate every app / site icon after a change here:
//   npm i --no-save opentype.js @fontsource/hanken-grotesk sharp
//   node scripts/brand/generate.mjs
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const opentype = require('opentype.js')

const buf = fs.readFileSync(require.resolve('@fontsource/hanken-grotesk/files/hanken-grotesk-latin-800-normal.woff'))
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

// back cloud first, front cloud second
export const THEMES = {
  light: { name: 'Light', bg: ['#eaf3fd', '#c6dcf5'], m: '#0f1b33', b: '#cf8f26', clouds: ['#f7fbff', '#ffffff'] },
  dark: { name: 'Dark', bg: ['#17244f', '#070c1d'], m: '#f6f8fc', b: '#ffd98a', clouds: ['#203060', '#2a3d72'] },
  sky: { name: 'Sky', bg: ['#1b2452', '#654a7e', '#e8957a'], m: '#ffffff', b: '#ffd98a', clouds: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.24)'] },
}

// the pair, centred on (50, 50) by its real outline
function letters({ capH = 31, gap = 1.8 } = {}) {
  const size = capH / (font.tables.os2.sCapHeight || 700) * font.unitsPerEm
  const gm = font.charToGlyph('M'), gb = font.charToGlyph('B')
  const k = size / font.unitsPerEm
  const bm = gm.getBoundingBox(), bb = gb.getBoundingBox()
  const place = (dx, dy) => {
    const xm = dx - bm.x1 * k, xb = dx + (bm.x2 - bm.x1) * k + gap - bb.x1 * k
    return [gm.getPath(xm, dy, size), gb.getPath(xb, dy, size)]
  }
  const [m0, b0] = place(0, 0)
  const a = m0.getBoundingBox(), c = b0.getBoundingBox()
  const x1 = Math.min(a.x1, c.x1), x2 = Math.max(a.x2, c.x2), y1 = Math.min(a.y1, c.y1), y2 = Math.max(a.y2, c.y2)
  const [m, b] = place(50 - (x1 + x2) / 2, 50 - (y1 + y2) / 2)
  return { m: m.toPathData(2), b: b.toPathData(2), box: { x1: 50 - (x2 - x1) / 2, x2: 50 + (x2 - x1) / 2, y1: 50 - (y2 - y1) / 2, y2: 50 + (y2 - y1) / 2 } }
}

// a simple cloud: a pill-shaped base and two bumps, all drawn clockwise so
// overlaps join; centred on (cx, cy), w wide; flip puts the big bump left
const circ = (x, y, r) => `M${(x - r).toFixed(2)},${y.toFixed(2)} a${r.toFixed(2)},${r.toFixed(2)} 0 1,1 ${(2 * r).toFixed(2)},0 a${r.toFixed(2)},${r.toFixed(2)} 0 1,1 ${(-2 * r).toFixed(2)},0 Z`
export function cloud(cx, cy, w, flip = false) {
  const s = w / 60, f = flip ? -1 : 1
  const r = 9 * s, x1 = cx - 30 * s + r, x2 = cx + 30 * s - r, top = cy - s, bot = cy + 17 * s
  const pill = `M${x1.toFixed(2)},${top.toFixed(2)} L${x2.toFixed(2)},${top.toFixed(2)} a${r.toFixed(2)},${r.toFixed(2)} 0 0,1 0,${(bot - top).toFixed(2)} L${x1.toFixed(2)},${bot.toFixed(2)} a${r.toFixed(2)},${r.toFixed(2)} 0 0,1 0,${(top - bot).toFixed(2)} Z`
  return [pill, circ(cx + 5 * s * f, cy, 17 * s), circ(cx - 14 * s * f, cy + 5 * s, 11 * s)].join(' ')
}

// the composition: a larger cloud low behind the M, a smaller one high behind the B
function layout() {
  const L = letters()
  return { L, clouds: [cloud(L.box.x1 + 12, L.box.y2 - 2, 44, true), cloud(L.box.x2 - 8, L.box.y1 + 2, 30)] }
}

const gradient = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`
const dims = size => (size ? ` width="${size}" height="${size}"` : '')
const frame = (inset, inner) => `<g transform="translate(${inset * 100} ${inset * 100}) scale(${1 - inset * 2})">${inner}</g>`

// a full icon; bg:false leaves the background transparent (Android adaptive foreground, splash)
export function iconSVG(_variant, theme, { id = 'x', size, inset = 0, bg = true } = {}) {
  const T = THEMES[theme], { L, clouds } = layout()
  const art = clouds.map((c, i) => `<path d="${c}" fill="${T.clouds[i]}"/>`).join('') + `<path d="${L.m}" fill="${T.m}"/><path d="${L.b}" fill="${T.b}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dims(size)}><defs>${gradient('g' + id, T.bg)}</defs>${bg ? `<rect width="100" height="100" fill="url(#g${id})"/>` : ''}${frame(inset, art)}</svg>`
}

// one colour on transparent: the letters alone (notification icon, themed / tinted icons)
export function monoSVG(_variant, { color = '#ffffff', size, inset = 0 } = {}) {
  const { L } = layout()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dims(size)}>${frame(inset, `<path d="${L.m}" fill="${color}"/><path d="${L.b}" fill="${color}"/>`)}</svg>`
}

export const glyphs = () => letters({ capH: 40 })
export const VARIANTS = { around: { name: 'Clouds around', note: '' } }

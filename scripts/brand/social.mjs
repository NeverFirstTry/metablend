// node scripts/brand/social.mjs — the profile picture for social accounts:
// the Sky icon with its background to the edges, the mark centred and scaled
// to sit inside the inner 70% of the circle the networks crop it to; 1080 and
// 400 px into store/social/ (needs: npm i --no-save opentype.js
// @fontsource/hanken-grotesk sharp)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { iconSVG } from './brand.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'store/social')
const SAFE = 0.7 // share of the crop circle's diameter the mark may reach

// how far the mark (letters and clouds) reaches from the middle of its square,
// as a share of the side — measured on a render, so it follows any change to the art
async function reach(svg, n) {
  const data = await sharp(Buffer.from(svg)).resize(n, n).ensureAlpha().raw().toBuffer()
  let max = 0
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (data[(y * n + x) * 4 + 3]) max = Math.max(max, Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2))
  }
  return max / n
}

// iconSVG's inset scales the mark about the middle by 1 - 2·inset; the
// background still fills the square
const r = await reach(iconSVG('around', 'sky', { size: 1000, bg: false }), 1000)
const inset = (1 - SAFE / 2 / r) / 2
fs.mkdirSync(OUT, { recursive: true })
for (const size of [1080, 400]) {
  const file = path.join(OUT, `profile-${size}.png`)
  await sharp(Buffer.from(iconSVG('around', 'sky', { size, inset }))).resize(size, size).png().toFile(file)
  // the mark as placed stays inside the safe circle (one pixel of edge smoothing allowed)
  const placed = await reach(iconSVG('around', 'sky', { size, inset, bg: false }), size)
  if (placed > SAFE / 2 + 1 / size) throw new Error(`${file}: the mark reaches ${(placed * 200).toFixed(1)}% of the circle, more than ${SAFE * 100}%`)
  console.log(`${path.relative(ROOT, file)}: the mark reaches ${(placed * 200).toFixed(1)}% of the circle`)
}

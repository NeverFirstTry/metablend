// node scripts/brand/social.mjs — the profile picture for social accounts:
// the Sky icon with its background to the edges, the mark centred and scaled
// for the circle the networks crop it to; 1080 and 400 px into store/social/
// (needs: npm i --no-save opentype.js @fontsource/hanken-grotesk sharp).
//   profile-*          the whole mark (letters and clouds) inside the inner 70%
//   profile-letters-*  the letters alone inside it: bigger letters, the faint
//                      clouds reach past that line but stay inside the crop
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { iconSVG, monoSVG } from './brand.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'store/social')
const SAFE = 0.7 // share of the crop circle's diameter the fitted part may reach

// how far a drawing reaches from the middle of its square, as a share of the
// side — measured on a render, so it follows any change to the art
async function reach(svg, n) {
  const data = await sharp(Buffer.from(svg)).resize(n, n).ensureAlpha().raw().toBuffer()
  let max = 0
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (data[(y * n + x) * 4 + 3]) max = Math.max(max, Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2))
  }
  return max / n
}

const mark = (size, inset) => iconSVG('around', 'sky', { size, inset, bg: false })
const VARIANTS = [
  { name: 'profile', fit: mark },
  { name: 'profile-letters', fit: (size, inset) => monoSVG('around', { size, inset }) },
]

fs.mkdirSync(OUT, { recursive: true })
for (const v of VARIANTS) {
  // iconSVG's inset scales the art about the middle by 1 - 2·inset; the
  // background still fills the square
  const inset = (1 - SAFE / 2 / await reach(v.fit(1000, 0), 1000)) / 2
  for (const size of [1080, 400]) {
    const file = path.join(OUT, `${v.name}-${size}.png`)
    await sharp(Buffer.from(iconSVG('around', 'sky', { size, inset }))).resize(size, size).png().toFile(file)
    // the fitted part stays inside the safe circle, the whole mark inside the crop
    // (one pixel of edge smoothing allowed)
    const placed = await reach(v.fit(size, inset), size)
    const whole = await reach(mark(size, inset), size)
    if (placed > SAFE / 2 + 1 / size) throw new Error(`${file}: reaches ${(placed * 200).toFixed(1)}% of the circle, more than ${SAFE * 100}%`)
    if (whole > 0.5) throw new Error(`${file}: the mark runs out of the round crop`)
    console.log(`${path.relative(ROOT, file)}: ${v.name === 'profile' ? 'the mark reaches' : 'the letters reach'} ${(placed * 200).toFixed(1)}% of the circle, the whole mark ${(whole * 200).toFixed(1)}%`)
  }
}

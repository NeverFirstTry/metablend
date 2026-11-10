// node scripts/brand/generate.mjs — writes every icon asset of the app and site
// (needs: npm i --no-save opentype.js @fontsource/hanken-grotesk sharp). The
// app icons are the designs in icons.mjs; the default one (Slate) is also the
// website's home-screen icon and the splash. The browser tab keeps its cloud.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { monoSVG, glyphs } from './brand.mjs'
import { ICONS, DEFAULT_ICON, iconArt, sceneArt, markArt, artOnly } from './icons.mjs'

const variant = 'around'
const WEB = ICONS.find(i => i.id === DEFAULT_ICON) // the website's home-screen icon and the splash
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const P = (...p) => path.join(ROOT, ...p)
const AR = P('mobile/android/app/src/main/res')
const IOS = P('mobile/ios/App/App/Assets.xcassets')
let n = 0
const id = () => `i${++n}`
const render = (svg, file, w, h = w) => sharp(Buffer.from(svg)).resize(w, h).png().toFile(file)
// place a 100×100-viewBox svg as a nested svg at (x, y), w wide
const nest = (svg, x, y, w) => svg.replace(/ width="\d+" height="\d+"/, '').replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${w}" `)
const clipped = (inner, size, shape) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><clipPath id="k">${shape === 'circle' ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>` : `<rect width="${size}" height="${size}" rx="${size * 0.18}"/>`}</clipPath></defs><g clip-path="url(#k)">${nest(inner, 0, 0, size)}</g></svg>`

// ---- web
fs.writeFileSync(P('public/icon.svg'), iconArt(WEB) + '\n')
for (const s of [192, 512]) {
  await render(iconArt(WEB, 'icon', s), P(`public/icon-${s}.png`), s)
  await render(iconArt(WEB, 'icon', s, 0.1), P(`public/icon-maskable-${s}.png`), s)
}
await render(iconArt(WEB, 'icon', 180), P('public/apple-touch-icon.png'), 180)
// the Play listing's icon is the website's 512 px one (scripts/store-shots.mjs copies it with the feature graphic)
fs.copyFileSync(P('public/icon-512.png'), P('fastlane/metadata/android/en-US/images/icon.png'))
// The browser-tab icon: like GitHub's, one plain mark on a transparent
// background — the logo's cloud, navy on light tabs, white on dark ones (the
// full icon is unreadable at 16 px).
// a chunkier cloud than the logo's, so it fills the square: pill base + two big bumps (all clockwise)
const bump = (x, y, r) => `M${x - r},${y} a${r},${r} 0 1,1 ${2 * r},0 a${r},${r} 0 1,1 ${-2 * r},0 Z`
const tabCloud = `M6.5,16.5 L25.5,16.5 a5.5,5.5 0 0,1 0,11 L6.5,27.5 a5.5,5.5 0 0,1 0,-11 Z ${bump(19.5, 15, 10)} ${bump(9.5, 18.5, 6.5)}`
fs.writeFileSync(P('public/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>path{fill:#0f1b33}@media (prefers-color-scheme:dark){path{fill:#f6f8fc}}</style><path d="${tabCloud}"/></svg>\n`)
// favicon.ico (browsers without SVG icons): the cloud in a mid blue that reads on light and dark tabs
const icoCloud = s => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${s}" height="${s}"><path d="${tabCloud}" fill="#5b7bb8"/></svg>`
// large PNG versions for search engines and bookmarks (Google prefers 48 px multiples)
for (const s of [192, 512]) await render(icoCloud(s), P(`public/favicon-${s}.png`), s)
const icoSizes = [16, 32, 48]
const pngs = await Promise.all(icoSizes.map(s => sharp(Buffer.from(icoCloud(s))).resize(s, s).png().toBuffer()))
const head = Buffer.alloc(6 + 16 * pngs.length)
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
let offset = head.length
pngs.forEach((b, i) => {
  const o = 6 + 16 * i, s = icoSizes[i]
  head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3)
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(b.length, o + 8); head.writeUInt32LE(offset, o + 12)
  offset += b.length
})
fs.writeFileSync(P('app/favicon.ico'), Buffer.concat([head, ...pngs]))

// ---- Android: one launcher icon per design (AndroidManifest.xml: an activity-alias each, AppIconPlugin)
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const adaptiveXML = suffix => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background${suffix}"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground${suffix}"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`
for (const icon of ICONS) {
  const suffix = icon.id === DEFAULT_ICON ? '' : `_${icon.id}`
  for (const [q, d] of Object.entries(D)) {
    const dir = path.join(AR, `mipmap-${q}`)
    const s = Math.round(48 * d), f = Math.round(108 * d), v = 72 * d, e = 18 * d
    await render(clipped(iconArt(icon, 'icon', s), s, 'square'), path.join(dir, `ic_launcher${suffix}.png`), s)
    await render(clipped(iconArt(icon, 'icon', s), s, 'circle'), path.join(dir, `ic_launcher${suffix}_round.png`), s)
    await render(markArt(icon, f), path.join(dir, `ic_launcher_foreground${suffix}.png`), f)
    // the background layer: the scene over the 72 dp a launcher shows, its edge pixels carried out to the
    // whole 108 dp layer (seen only while a launcher moves the layers)
    await sharp(Buffer.from(sceneArt(icon, v))).resize(v, v).extend({ top: e, bottom: e, left: e, right: e, extendWith: 'copy' }).png().toFile(path.join(dir, `ic_launcher_background${suffix}.png`))
    if (!suffix) await render(monoSVG(variant, { id: id(), size: f, inset: 0.1667 }), path.join(dir, 'ic_launcher_monochrome.png'), f)
  }
  fs.writeFileSync(path.join(AR, `mipmap-anydpi-v26/ic_launcher${suffix}.xml`), adaptiveXML(suffix))
  fs.writeFileSync(path.join(AR, `mipmap-anydpi-v26/ic_launcher${suffix}_round.xml`), adaptiveXML(suffix))
}
// the designs before 2026-11-10: vector backgrounds, and Dark, which Slate replaces
for (const d of ['', '_light', '_dark']) fs.rmSync(path.join(AR, `drawable/ic_launcher_background${d}.xml`), { force: true })
for (const x of ['ic_launcher_dark.xml', 'ic_launcher_dark_round.xml']) fs.rmSync(path.join(AR, 'mipmap-anydpi-v26', x), { force: true })
for (const q of Object.keys(D)) for (const x of ['ic_launcher_dark.png', 'ic_launcher_dark_round.png', 'ic_launcher_foreground_dark.png']) fs.rmSync(path.join(AR, `mipmap-${q}`, x), { force: true })
fs.rmSync(path.join(AR, 'drawable-v24/ic_launcher_foreground.xml'), { force: true })

// splash: the default icon's background with its art in the middle
const splash = (w, h, frac = 0.34) => {
  const mark = Math.round(Math.min(w, h) * frac)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${WEB.bg}"/>${nest(artOnly(WEB, mark), (w - mark) / 2, (h - mark) / 2, mark)}</svg>`
}
for (const dir of fs.readdirSync(AR).filter(d => d.startsWith('drawable'))) {
  const f = path.join(AR, dir, 'splash.png')
  if (!fs.existsSync(f)) continue
  const b = fs.readFileSync(f), w = b.readUInt32BE(16), h = b.readUInt32BE(20)
  await render(splash(w, h), f, w, h)
}

// notification icon: the letters as a vector, white
const L = glyphs({ baseline: 66, capH: 40 })
fs.writeFileSync(path.join(AR, 'drawable/ic_stat_notify.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- Status-bar icon for push notifications: the M and B of the logo as a
     white silhouette (Android shows only the alpha, tinted with notification_accent). -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="100"
    android:viewportHeight="100">
    <path android:fillColor="#FFFFFF" android:pathData="${L.m}" />
    <path android:fillColor="#FFFFFF" android:pathData="${L.b}" />
</vector>
`)

// ---- iOS: one icon set per design, each with its dark and tinted look; the default is the primary AppIcon,
// the others are named in ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES (project.pbxproj)
for (const icon of ICONS) {
  const primary = icon.id === DEFAULT_ICON
  const set = path.join(IOS, primary ? 'AppIcon.appiconset' : `AppIcon-${icon.id[0].toUpperCase() + icon.id.slice(1)}.appiconset`)
  fs.rmSync(set, { recursive: true, force: true })
  fs.mkdirSync(set, { recursive: true })
  const file = look => (primary ? 'AppIcon' : 'icon') + (look === 'icon' ? (primary ? '-512@2x' : '') : `-${look}`) + '.png'
  for (const look of ['icon', 'dark', 'tinted']) await render(iconArt(icon, look, 1024), path.join(set, file(look)), 1024)
  fs.writeFileSync(path.join(set, 'Contents.json'), JSON.stringify({
    images: ['icon', 'dark', 'tinted'].map(look => ({
      ...(look === 'icon' ? {} : { appearances: [{ appearance: 'luminosity', value: look }] }),
      filename: file(look), idiom: 'universal', platform: 'ios', size: '1024x1024',
    })),
    info: { author: 'xcode', version: 1 },
  }, null, 2) + '\n')
}
fs.rmSync(path.join(IOS, 'AppIcon-Dark.appiconset'), { recursive: true, force: true })

for (const f of fs.readdirSync(path.join(IOS, 'Splash.imageset')).filter(f => f.endsWith('.png'))) {
  await render(splash(2732, 2732, 0.16), path.join(IOS, 'Splash.imageset', f), 2732)
}

// ---- the picker's previews (More → App icon)
fs.rmSync(P('public/app-icons'), { recursive: true, force: true })
fs.mkdirSync(P('public/app-icons'), { recursive: true })
for (const icon of ICONS) await render(clipped(iconArt(icon, 'icon', 168), 168, 'square'), P(`public/app-icons/${icon.id}.png`), 168)
console.log('done')

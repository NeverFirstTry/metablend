// node scripts/brand/generate.mjs [variant] [defaultTheme] — writes every icon
// asset of the app and site (needs: npm i --no-save opentype.js
// @fontsource/hanken-grotesk sharp). Web and Android get the default theme
// (sky); iPhone gets light / dark / tinted.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { iconSVG, monoSVG, glyphs, THEMES } from './brand.mjs'

const variant = process.argv[2] ?? 'around'
const DEFAULT = process.argv[3] ?? 'sky' // web + Android default icon
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
const T = THEMES[DEFAULT]

// ---- web
fs.writeFileSync(P('public/icon.svg'), iconSVG(variant, DEFAULT, { id: 'fav' }))
for (const s of [192, 512]) {
  await render(iconSVG(variant, DEFAULT, { id: id(), size: s }), P(`public/icon-${s}.png`), s)
  await render(iconSVG(variant, DEFAULT, { id: id(), size: s, inset: 0.1 }), P(`public/icon-maskable-${s}.png`), s)
}
await render(iconSVG(variant, DEFAULT, { id: id(), size: 180 }), P('public/apple-touch-icon.png'), 180)
// The browser-tab icon: like GitHub's, one plain mark on a transparent
// background — the logo's cloud, navy on light tabs, white on dark ones (the
// full icon is unreadable at 16 px).
// a chunkier cloud than the logo's, so it fills the square: pill base + two big bumps (all clockwise)
const bump = (x, y, r) => `M${x - r},${y} a${r},${r} 0 1,1 ${2 * r},0 a${r},${r} 0 1,1 ${-2 * r},0 Z`
const tabCloud = `M6.5,16.5 L25.5,16.5 a5.5,5.5 0 0,1 0,11 L6.5,27.5 a5.5,5.5 0 0,1 0,-11 Z ${bump(19.5, 15, 10)} ${bump(9.5, 18.5, 6.5)}`
fs.writeFileSync(P('public/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>path{fill:#0f1b33}@media (prefers-color-scheme:dark){path{fill:#f6f8fc}}</style><path d="${tabCloud}"/></svg>\n`)
// favicon.ico (browsers without SVG icons): the cloud in a mid blue that reads on light and dark tabs
const icoCloud = s => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${s}" height="${s}"><path d="${tabCloud}" fill="#5b7bb8"/></svg>`
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

// ---- Android
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [q, d] of Object.entries(D)) {
  const dir = path.join(AR, `mipmap-${q}`)
  const s = Math.round(48 * d), f = Math.round(108 * d)
  await render(clipped(iconSVG(variant, DEFAULT, { id: id(), size: s }), s, 'square'), path.join(dir, 'ic_launcher.png'), s)
  await render(clipped(iconSVG(variant, DEFAULT, { id: id(), size: s }), s, 'circle'), path.join(dir, 'ic_launcher_round.png'), s)
  await render(iconSVG(variant, DEFAULT, { id: id(), size: f, inset: 0.1667, bg: false }), path.join(dir, 'ic_launcher_foreground.png'), f)
  await render(monoSVG(variant, { id: id(), size: f, inset: 0.1667 }), path.join(dir, 'ic_launcher_monochrome.png'), f)
}
// adaptive-icon background (the theme's sky as a vector gradient) and the icon XML
const backgroundXML = theme => {
  const stops = THEMES[theme].bg.map((c, i, all) => `<item android:offset="${(i / (all.length - 1)).toFixed(2)}" android:color="${c}"/>`).join('\n                ')
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Adaptive-icon background: the icon's sky, top to bottom -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient android:type="linear" android:startX="54" android:startY="0" android:endX="54" android:endY="108">
                ${stops}
            </gradient>
        </aapt:attr>
    </path>
</vector>
`
}
const adaptiveXML = suffix => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background${suffix}"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground${suffix}"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`
fs.writeFileSync(path.join(AR, 'drawable/ic_launcher_background.xml'), backgroundXML(DEFAULT))
fs.writeFileSync(path.join(AR, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptiveXML(''))
fs.writeFileSync(path.join(AR, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptiveXML(''))
fs.rmSync(path.join(AR, 'drawable-v24/ic_launcher_foreground.xml'), { force: true })

// splash: the icon's sky with the mark in the middle
const splash = (w, h, frac = 0.34) => {
  const mark = Math.round(Math.min(w, h) * frac)
  const bgStops = T.bg.map((c, i) => `<stop offset="${i / (T.bg.length - 1)}" stop-color="${c}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">${bgStops}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/>${nest(iconSVG(variant, DEFAULT, { id: id(), bg: false }), (w - mark) / 2, (h - mark) / 2, mark)}</svg>`
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

// ---- iOS: light / dark / tinted app icon, splash
const icon = path.join(IOS, 'AppIcon.appiconset')
await render(iconSVG(variant, 'light', { id: id(), size: 1024 }), path.join(icon, 'AppIcon-512@2x.png'), 1024)
await render(iconSVG(variant, 'dark', { id: id(), size: 1024 }), path.join(icon, 'AppIcon-dark.png'), 1024)
const tinted = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#000"/>${nest(monoSVG(variant, { id: id() }), 0, 0, 1024)}</svg>`
await render(tinted, path.join(icon, 'AppIcon-tinted.png'), 1024)
fs.writeFileSync(path.join(icon, 'Contents.json'), JSON.stringify({
  images: [
    { filename: 'AppIcon-512@2x.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    { appearances: [{ appearance: 'luminosity', value: 'dark' }], filename: 'AppIcon-dark.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    { appearances: [{ appearance: 'luminosity', value: 'tinted' }], filename: 'AppIcon-tinted.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
  ],
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n')
for (const f of fs.readdirSync(path.join(IOS, 'Splash.imageset')).filter(f => f.endsWith('.png'))) {
  await render(splash(2732, 2732, 0.16), path.join(IOS, 'Splash.imageset', f), 2732)
}

// ---- alternate icons for More → App icon
fs.mkdirSync(P('public/app-icons'), { recursive: true })
for (const theme of Object.keys(THEMES)) {
  const Name = theme[0].toUpperCase() + theme.slice(1)
  // iOS: one app icon set per theme (named in ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES)
  const set = path.join(IOS, `AppIcon-${Name}.appiconset`)
  fs.mkdirSync(set, { recursive: true })
  await render(iconSVG(variant, theme, { id: id(), size: 1024 }), path.join(set, 'icon.png'), 1024)
  fs.writeFileSync(path.join(set, 'Contents.json'), JSON.stringify({ images: [{ filename: 'icon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2) + '\n')
  // the picker's previews
  await render(clipped(iconSVG(variant, theme, { id: id(), size: 168 }), 168, 'square'), P(`public/app-icons/${theme}.png`), 168)
  if (theme === DEFAULT) continue // Android's main launcher icon already is this one
  // Android: launcher icons for the activity-alias of this theme
  for (const [q, d] of Object.entries(D)) {
    const dir = path.join(AR, `mipmap-${q}`)
    const s = Math.round(48 * d), f = Math.round(108 * d)
    await render(clipped(iconSVG(variant, theme, { id: id(), size: s }), s, 'square'), path.join(dir, `ic_launcher_${theme}.png`), s)
    await render(clipped(iconSVG(variant, theme, { id: id(), size: s }), s, 'circle'), path.join(dir, `ic_launcher_${theme}_round.png`), s)
    await render(iconSVG(variant, theme, { id: id(), size: f, inset: 0.1667, bg: false }), path.join(dir, `ic_launcher_foreground_${theme}.png`), f)
  }
  fs.writeFileSync(path.join(AR, `drawable/ic_launcher_background_${theme}.xml`), backgroundXML(theme))
  fs.writeFileSync(path.join(AR, `mipmap-anydpi-v26/ic_launcher_${theme}.xml`), adaptiveXML(`_${theme}`))
  fs.writeFileSync(path.join(AR, `mipmap-anydpi-v26/ic_launcher_${theme}_round.xml`), adaptiveXML(`_${theme}`))
}
// "Automatic" preview: the light icon top left, the dark one bottom right
const half = (points, svg) => `<g clip-path="url(#${points})">${nest(svg, 0, 0, 168)}</g>`
const auto = `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168" viewBox="0 0 168 168"><defs><clipPath id="tl"><polygon points="0,0 168,0 0,168"/></clipPath><clipPath id="br"><polygon points="168,0 168,168 0,168"/></clipPath></defs>${half('tl', iconSVG(variant, 'light', { id: id(), size: 168 }))}${half('br', iconSVG(variant, 'dark', { id: id(), size: 168 }))}</svg>`
await render(clipped(auto, 168, 'square'), P('public/app-icons/auto.png'), 168)
console.log('done', variant, DEFAULT)

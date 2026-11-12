// node scripts/brand/press-kit.mjs [base] — the press kit (owner 2026-11-11, launch 15 December):
// public/press/metablend-press-kit.zip, and beside it the few files /press shows as previews.
//   Logo: wordmark (scripts/brand/wordmark.mjs) and MB mark (brand.mjs), dark and light, SVG and PNG
//   App icon in Slate (icons.mjs), SVG and PNG
//   The store screenshots in English (fastlane/, Slate frame) and the Play feature graphic
//   Three app screenshots without captions, taken now from <base> (default https://metablend.app) in the
//   app view at the App Store's size: read-only page loads with the analytics blocked, like the other captures.
//   Run it in the morning, Alps time: it refuses a summit past Today or "No favourable" (from the evening on).
//   It also refuses a shot that shows a dash or a safety word anywhere on screen.
//   KEEP=2-summit,3-route keeps those shots from the last kit in public/press/ instead of taking them again
//   (while a page they show is about to change).
// Needs: npm i --no-save opentype.js @fontsource/hanken-grotesk sharp
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { letters } from './brand.mjs'
import { ICONS, DEFAULT_ICON, iconArt } from './icons.mjs'
import { wordmarkSVG, WORDMARK } from './wordmark.mjs'
import { zip, unzip } from '../lib/zip.mjs'
import { DASH } from '../../lib/wording.js'
import { launchBrowser } from '../lib/browser.mjs'
import { blockAnalytics, analyticsLeak } from '../lib/analytics-block.mjs'
import { PRESS } from '../../lib/press.js'
import { TERMS_CAPTURE_SCRIPT } from '../../lib/terms.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const P = (...p) => path.join(ROOT, ...p)
const OUT = P('public/press'), KIT = 'MetaBlend press kit'
const BASE = process.argv[2] ?? 'https://metablend.app'
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const png = (svg, width) => sharp(Buffer.from(svg)).resize({ width }).png().toBuffer()
const files = [] // [path in the kit, Buffer]
const add = (name, data) => files.push([name, Buffer.isBuffer(data) ? data : Buffer.from(data)])

// ---- logo: the wordmark, and the MB mark with a little room around its letters
const L = letters()
const markSVG = ({ meta, blend }) => {
  const pad = 4, { x1, y1, x2, y2 } = L.box
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(x1 - pad).toFixed(2)} ${(y1 - pad).toFixed(2)} ${(x2 - x1 + 2 * pad).toFixed(2)} ${(y2 - y1 + 2 * pad).toFixed(2)}"><path fill="${meta}" d="${L.m}"/><path fill="${blend}" d="${L.b}"/></svg>`
}
for (const look of ['dark', 'light']) {
  const word = wordmarkSVG(WORDMARK[look]), mark = markSVG(WORDMARK[look])
  add(`logo/metablend-wordmark-${look}.svg`, word + '\n')
  add(`logo/metablend-wordmark-${look}.png`, await png(word, 2000))
  add(`logo/metablend-mark-${look}.svg`, mark + '\n')
  add(`logo/metablend-mark-${look}.png`, await png(mark, 1024))
}

// ---- the app icon in Slate
const slate = ICONS.find(i => i.id === DEFAULT_ICON)
add('app-icon/metablend-app-icon.svg', iconArt(slate) + '\n')
add('app-icon/metablend-app-icon-1024.png', await png(iconArt(slate, 'icon', 1024), 1024))

// ---- the store screenshots in English and the feature graphic, as they go to the stores
for (let n = 1; n <= 5; n++) {
  add(`screenshots/app-store/${n}.png`, fs.readFileSync(P('fastlane/screenshots/en-US', `${n}.png`)))
  add(`screenshots/google-play/${n}.png`, fs.readFileSync(P('fastlane/metadata/android/en-US/images/phoneScreenshots', `${n}.png`)))
}
add('feature-graphic/metablend-feature-graphic.png', fs.readFileSync(P('fastlane/metadata/android/en-US/images/featureGraphic.png')))

// ---- three app screenshots without captions, from the live app view
const SHOTS = [
  ['1-forecast', '/?city=Vienna', `!!document.querySelector('.text-7xl')`],
  ['2-summit', '/hike?peak=grossglockner', `!![...document.querySelectorAll('[role=tab]')].length`],
  ['3-route', '/hike?peak=grossglockner&route=osm-14622955', `!!document.querySelector('.leaflet-tile-loaded')`],
]
const KEEP = (process.env.KEEP ?? '').split(',').filter(Boolean)
for (const name of KEEP) if (!SHOTS.some(s => s[0] === name)) throw new Error(`KEEP: no shot called ${name}`)
const last = KEEP.length ? Object.fromEntries(unzip(fs.readFileSync(path.join(OUT, 'metablend-press-kit.zip'))).map(f => [f.name, f.data])) : {}
// every text node on screen, for the check that no shot shows a dash or a safety word
const ON_SCREEN = `(() => { const out = [], r = document.createRange(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = w.nextNode());) { if (!n.textContent.trim()) continue; r.selectNodeContents(n); const b = r.getBoundingClientRect()
    if (b.width && b.height && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth && n.parentElement.checkVisibility({ opacityProperty: true, visibilityProperty: true })) out.push(n.textContent.trim()) }
  return out })()`
const sleep = ms => new Promise(r => setTimeout(r, ms))
const { targets, close } = await launchBrowser(EDGE, 'press-')
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
const analytics = await blockAnalytics(ws, send)
const { userAgent } = (await send('Browser.getVersion')).result
await send('Network.setUserAgentOverride', { userAgent: `${userAgent} MetaBlendApp MetaBlendLayoutCheck/1` })
await send('Page.addScriptToEvaluateOnNewDocument', { source: TERMS_CAPTURE_SCRIPT })
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 3, mobile: true })
for (const [k, v] of [['metablend_lang', 'en'], ['metablend_theme', 'dark']]) await send('Network.setCookie', { name: k, value: v, url: BASE + '/' })
try {
  for (const [name, url, ready] of SHOTS) {
    if (KEEP.includes(name)) {
      const kept = last[`${KIT}/screenshots/app/${name}.png`]
      if (!kept) throw new Error(`${name}: not in the last kit, so it cannot be kept`)
      add(`screenshots/app/${name}.png`, kept)
      console.log(`${name} kept from the last kit`)
      continue
    }
    await send('Page.navigate', { url: BASE + url })
    let ok = false
    for (let i = 0; i < 120 && !ok; i++) { await sleep(250); ok = await ev(`document.documentElement.dataset.app === '1' && ${ready}`) }
    if (!ok) throw new Error(`${name}: ${url} did not show in the app view`)
    // the search field stays empty, as on the store screenshots
    await ev(`(() => { const i = document.querySelector('.home-search input'); if (!i) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur() })()`)
    await sleep(4000) // the entrance and the map tiles settle
    // the press sees the feature working, as the stores do: a summit on Today and a route with a start today,
    // which in the Alps means a capture in the morning
    const night = await ev(`document.body.innerText.includes('No favourable') || [...document.querySelectorAll('[role=tab][aria-selected=true]')].some(t => /Tomorrow|Week/.test(t.textContent))`)
    if (night) throw new Error(`${name}: shows "No favourable" or a tab past Today; run this in the morning, Alps time`)
    const bad = (await ev(ON_SCREEN)).filter(t => DASH.test(t) || /safe|sicher/i.test(t))
    if (bad.length) throw new Error(`${name}: shows ${bad.map(t => `"${t}"`).join(', ')}`)
    const { result } = await send('Page.captureScreenshot', { format: 'png' })
    add(`screenshots/app/${name}.png`, Buffer.from(result.data, 'base64'))
    console.log(`${name} ✓`)
  }
} finally { ws.close(); await close() }
const leak = analyticsLeak(analytics)
if (leak) throw new Error(leak)

// ---- the README, English then German, from lib/press.js
const readme = ['en', 'de'].map(lang => {
  const p = PRESS[lang]
  return [lang === 'en' ? 'MetaBlend press kit' : 'MetaBlend Pressemappe', '', p.intro, '', p.factsTitle, ...p.facts.map(([k, v]) => `${k}: ${v}`), '',
    `${p.contactTitle}: info@metablend.app`, 'https://metablend.app/press', '', ...p.kitItems.map(i => `* ${i}`), '', p.kitText.replace(' ({size})', '')].join('\n')
}).join('\n\n\n')
add('README.txt', readme + '\n')

// ---- the zip, and the previews /press shows
fs.mkdirSync(OUT, { recursive: true })
const archive = zip(files.map(([name, data]) => ({ name: `${KIT}/${name}`, data })))
fs.writeFileSync(path.join(OUT, 'metablend-press-kit.zip'), archive)
const kit = Object.fromEntries(files)
fs.writeFileSync(path.join(OUT, 'metablend-wordmark-dark.svg'), kit['logo/metablend-wordmark-dark.svg'])
fs.writeFileSync(path.join(OUT, 'metablend-wordmark-light.svg'), kit['logo/metablend-wordmark-light.svg'])
fs.writeFileSync(path.join(OUT, 'metablend-mark-dark.svg'), kit['logo/metablend-mark-dark.svg'])
fs.writeFileSync(path.join(OUT, 'metablend-app-icon.png'), await sharp(kit['app-icon/metablend-app-icon-1024.png']).resize(512).png().toBuffer())
console.log(`${files.length} files, ${(archive.length / 1e6).toFixed(1)} MB: public/press/metablend-press-kit.zip; analytics: ${analytics.blocked} blocked`)

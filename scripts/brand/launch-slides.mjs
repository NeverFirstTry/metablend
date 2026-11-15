// node scripts/brand/launch-slides.mjs: the launch carousel for Instagram (owner 2026-11-15, posted on 15 December by Rene),
// 5 slides of 1080 x 1350 per language (de, en) into store/social/launch-2026-12-15/slides/<lang>-<n>.png.
//   1 what MetaBlend does (screens/forecast-<lang>.png), 2 the consensus idea (the promo film's last frame, its own heading
//   cut off), 3 summit forecasts (screens/summit-<lang>.png), 4 alerts and widgets (rene/alerts-<lang>.png and
//   rene/widgets-<lang>.png from Rene's phone, the alerts cut to start at the "Notifications" heading; dashed placeholders
//   until they are there), 5 the stores' own badges, unaltered. ONLY=4 renders just that slide (ONLY=1,4 several).
//   The screens come from scripts/brand/launch-screens.mjs. The words are the store listing's own (fastlane/metadata).
//   The store frames' look: solid Slate with the day glow, Hanken Grotesk 800, gold only in the wordmark.
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { launchBrowser } from '../lib/browser.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DIR = path.join(ROOT, 'store/social/launch-2026-12-15')
const SCREENS = process.env.SCREENS ?? path.join(DIR, 'screens')
const OUT = process.env.OUT ?? path.join(DIR, 'slides')
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
fs.mkdirSync(OUT, { recursive: true })
const b64 = (f, type) => `data:${type};base64,${fs.readFileSync(f).toString('base64')}`
const png = f => b64(f, 'image/png')
// Rene's alerts shots (1320 x 2868) start at the "Notifications" heading: the rows above are the theme thumbnails behind the
// status bar (owner 2026-11-15). shortcut: a fixed row for this layout; a retake with another phone or layout trips the check.
const ALERTS_TOP = 312
const alertsCrop = async f => {
  const img = sharp(f), { width, height } = await img.metadata()
  const { data } = await sharp(f).extract({ left: 0, top: ALERTS_TOP + 20, width, height: 100 }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let gold = 0
  for (let i = 0; i < data.length; i += 3) if (data[i] > 190 && data[i + 1] > 150 && data[i + 2] < 140 && data[i] - data[i + 2] > 70) gold++
  if (gold < 200) throw new Error(`${path.basename(f)}: no gold heading just below row ${ALERTS_TOP}; check ALERTS_TOP`)
  return `data:image/png;base64,${(await img.extract({ left: 0, top: ALERTS_TOP, width, height: height - ALERTS_TOP }).png().toBuffer()).toString('base64')}`
}
// the film's last frame without its own heading (the slide's heading takes its place)
const poster = async lang => `data:image/png;base64,${(await sharp(path.join(ROOT, `public/promo/metablend-1x1-${lang}-poster.webp`)).extract({ left: 0, top: 230, width: 1080, height: 850 }).png().toBuffer()).toString('base64')}`

const TEXT = {
  en: [
    ['One forecast from up to 20 weather sources', 'Weather and summit forecasts in 13 languages.'],
    ['One forecast, and how much the sources agree', 'Sources that keep getting your region right count for more.'],
    ['Summit forecasts worldwide', 'Wind on top, freezing level, storm risk and the favourable window to be on the summit.'],
    ['Alerts and widgets', 'Alerts for rain, storms, severe weather and heat. Widgets for your city and your next hike.'],
    ['MetaBlend is on the App Store and Google Play', 'No account, no ads, free. In 13 languages.'],
  ],
  de: [
    ['Eine Vorhersage aus bis zu 20 Wetterquellen', 'Wetter- und Gipfelprognosen in 13 Sprachen.'],
    ['Eine Vorhersage, und wie einig sich die Quellen sind', 'Quellen, die in deiner Region immer wieder richtig liegen, zählen mehr.'],
    ['Gipfelprognosen weltweit', 'Wind oben, Nullgradgrenze, Gewitterrisiko und das günstige Zeitfenster am Gipfel.'],
    ['Hinweise und Widgets', 'Hinweise bei Regen, Gewitter, Unwetter und Hitze. Widgets für deinen Ort und deine nächste Tour.'],
    ['MetaBlend gibt es im App Store und bei Google Play', 'Kein Konto, keine Werbung, kostenlos. In 13 Sprachen.'],
  ],
}
const HOLD = { en: ['Rene’s screenshot: rene/alerts-en.png', 'Rene’s screenshot: rene/widgets-en.png'], de: ['Renes Screenshot: rene/alerts-de.png', 'Renes Screenshot: rene/widgets-de.png'] }

const page = (head, sub, body) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;700;800&display=block" rel="stylesheet">
<style>
html,body{margin:0;width:1080px;height:1350px;overflow:hidden}
body{background-color:#0f151b;background-image:radial-gradient(90% 55% at 50% 0%,rgba(255,217,138,.18),rgba(255,217,138,0) 75%);font-family:'Hanken Grotesk',system-ui,sans-serif;color:#f6f8fc;position:relative}
.top{position:absolute;left:88px;right:88px;top:80px}
.mark{font-weight:800;font-size:40px;letter-spacing:-0.01em}.mark b{color:#ffd98a;font-weight:800}
h1{margin:40px 0 0;font-weight:800;font-size:68px;line-height:1.1;letter-spacing:-0.015em;text-wrap:balance}
p{margin:22px 0 0;font-weight:500;font-size:34px;line-height:1.35;color:rgba(226,234,247,.78);text-wrap:pretty;max-width:860px}
.phone{position:absolute;left:50%;transform:translateX(-50%);width:640px;border-radius:48px 48px 0 0;box-shadow:0 20px 60px rgba(0,0,0,.5);outline:2px solid rgba(255,255,255,.08)}
.pair{position:absolute;left:88px;right:88px;top:600px;bottom:0;display:flex;gap:40px}
.pair img{flex:1;min-width:0;height:100%;object-fit:cover;object-position:top;border-radius:40px 40px 0 0;box-shadow:0 20px 60px rgba(0,0,0,.5);outline:2px solid rgba(255,255,255,.08)}
.hold{flex:1;border:3px dashed rgba(226,234,247,.35);border-bottom:none;border-radius:40px 40px 0 0;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px;font-weight:700;font-size:30px;line-height:1.3;color:rgba(226,234,247,.62)}
.badges{position:absolute;left:88px;bottom:330px;display:flex;gap:36px;align-items:center}.badges img{height:120px;width:auto;display:block}
.site{position:absolute;left:88px;bottom:200px;font-weight:700;font-size:44px}
.icon{position:absolute;left:88px;top:560px;width:200px;height:200px;border-radius:45px;outline:2px solid rgba(255,255,255,.14);box-shadow:0 12px 40px rgba(0,0,0,.45)}
</style></head><body><div class="top"><div class="mark">Meta<b>Blend</b></div><h1>${head}</h1><p>${sub}</p></div>${body}</body></html>`

const missing = []
const html = async (lang, n) => {
  const [head, sub] = TEXT[lang][n]
  const scr = name => png(path.join(SCREENS, `${name}-${lang}.png`))
  if (n === 0) return page(head, sub, `<img class="phone" style="top:560px" src="${scr('forecast')}">`)
  if (n === 1) return page(head, sub, `<img style="position:absolute;left:0;bottom:0;width:1080px;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 220px);mask-image:linear-gradient(to bottom,transparent 0,#000 220px)" src="${await poster(lang)}">`)
  if (n === 2) return page(head, sub, `<img class="phone" style="top:600px" src="${scr('summit')}">`)
  if (n === 3) {
    const cells = await Promise.all(['alerts', 'widgets'].map(async (k, i) => {
      const f = path.join(DIR, 'rene', `${k}-${lang}.png`)
      if (fs.existsSync(f)) return `<img src="${k === 'alerts' ? await alertsCrop(f) : png(f)}" alt="">`
      missing.push(path.relative(ROOT, f).replace(/\\/g, '/'))
      return `<div class="hold">${HOLD[lang][i]}</div>`
    }))
    return page(head, sub, `<div class="pair">${cells.join('')}</div>`)
  }
  const badge = (f, type) => b64(path.join(ROOT, 'public/badges', f), type)
  return page(head, sub, `<div class="badges"><img src="${badge(`app-store-${lang}.svg`, 'image/svg+xml')}" alt=""><img src="${badge(`google-play-${lang}.png`, 'image/png')}" alt=""></div>
<div class="site">metablend.app</div><img class="icon" src="${png(path.join(ROOT, 'public/press/metablend-app-icon.png'))}" alt="">`)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const { targets, close } = await launchBrowser(EDGE, 'slides-')
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0; const pending = new Map()
const send = (method, params = {}) => new Promise(r => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })) })
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
try {
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false })
  const only = (process.env.ONLY ?? '1,2,3,4,5').split(',').map(x => Number(x) - 1)
  for (const lang of ['en', 'de']) for (const n of only) {
    await send('Page.navigate', { url: 'about:blank' }); await sleep(150)
    const { result } = await send('Page.getFrameTree')
    await send('Page.setDocumentContent', { frameId: result.frameTree.frame.id, html: await html(lang, n) })
    // display=block keeps the text invisible until the font is in: wait for the stylesheet, the font and every image
    let ready = false
    for (let i = 0; i < 80 && !ready; i++) { await sleep(250); ready = await ev(`(async () => { const c = document.querySelector('link[rel=stylesheet]'); if (c && !c.sheet) return false; await document.fonts.load('800 40px "Hanken Grotesk"'); await document.fonts.load('500 34px "Hanken Grotesk"'); return [...document.fonts].some(f => f.family.includes('Hanken') && f.status === 'loaded') && [...document.images].every(i => i.complete) })()`) }
    if (!ready) throw new Error(`${lang} ${n + 1}: the font or an image did not load`)
    const lines = await ev(`(() => { const h = document.querySelector('h1'); return Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)) })()`)
    if (lines > 3) throw new Error(`${lang} ${n + 1}: the heading takes ${lines} lines`)
    await sleep(300)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, `${lang}-${n + 1}.png`), Buffer.from(shot.result.data, 'base64'))
    console.log(`${lang} ${n + 1} ✓`)
  }
} finally { ws.close(); await close() }
if (missing.length) console.log(`slide 4 has placeholders, still missing: ${missing.join(', ')}`)

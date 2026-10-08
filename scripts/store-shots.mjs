// Captioned store screenshots from a local production build, every language:
//   npx next build && npx next start -p 3123      (separate terminal)
//   node scripts/store-shots.mjs [lang …]         (default: all 13)
// Writes fastlane/screenshots/<ios>/ (1290×2796) and
// fastlane/metadata/android/<android>/images/phoneScreenshots/ (1080×1920),
// plus the Play feature graphic and icon in en-US.
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCALES } from '../store/locales.js'
import { t } from '../lib/i18n.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE ?? 'http://localhost:3123'
const PORT = 9371
const CAPTIONS = JSON.parse(readFileSync(join(ROOT, 'store/captions.json'), 'utf8'))
const DEVICES = [
  { id: 'ios', w: 430, h: 932, scale: 3, out: l => l.ios && join(ROOT, 'fastlane/screenshots', l.ios) },
  { id: 'android', w: 360, h: 640, scale: 3, out: l => join(ROOT, 'fastlane/metadata/android', l.android, 'images/phoneScreenshots') },
]
const SCREENS = [
  // Ready = the range tabs are there (not a text length: Japanese / Chinese /
  // Korean pages are short). The app remembers the last tab, so both forecast
  // shots pick theirs: Today, then Week.
  { path: '/?city=Vienna', ready: `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '§tabWeek') && !document.documentElement.dataset.localizing`, tab: 'tabToday' },
  { path: '/?city=Vienna', ready: `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '§tabWeek') && !document.documentElement.dataset.localizing`, tab: 'tabWeek' },
  { path: '/hike', ready: `document.querySelectorAll('details').length > 0 && document.body.innerText.includes(${JSON.stringify('§nearYou')})` },
  { path: '/hike?peak=grossglockner', ready: `!!document.querySelector('[role=region][aria-label]') && document.querySelectorAll('svg').length > 3` }, // the hour strip, in any language (French says CAS, not SAC)
  // tomorrow: by the afternoon today has no safe start left, whenever the script runs
  { path: '/hike?peak=grossglockner&route=osm-14622955', ready: `!!document.querySelector('.leaflet-container') && document.body.innerText.includes(':')`, pickTomorrow: true },
]
const sleep = ms => new Promise(r => setTimeout(r, ms))

const prof = mkdtempSync(join(tmpdir(), 'storeshots-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40 && !targets; i++) { await sleep(250); targets = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json()).catch(() => null) }
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const until = async (expr, ms = 30000) => { for (let s = 0; s < ms; s += 250) { if (await ev(expr)) return true; await sleep(250) } throw new Error(`timeout: ${expr}`) }
const png = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64')
const sizeOf = buf => [buf.readUInt32BE(16), buf.readUInt32BE(20)]
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

// a viewport tag, or mobile emulation lays the page out 980 px wide and shrinks it
const HEAD = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'

function frame(caption, shot, d) {
  return `<!doctype html><html><head>${HEAD}
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&display=block" rel="stylesheet">
<style>html,body{margin:0;width:${d.w}px;height:${d.h}px;overflow:hidden}
body{background:linear-gradient(180deg,#0f1b33 0%,#1d3a6b 55%,#3f6fb0 100%);font-family:'Hanken Grotesk',system-ui,sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center}
h1{margin:${Math.round(d.h * 0.07)}px ${Math.round(d.w * 0.08)}px ${Math.round(d.h * 0.035)}px;font-size:${Math.round(d.w * 0.075)}px;line-height:1.15;font-weight:800;text-align:center;letter-spacing:-0.01em;text-wrap:balance}
img{width:${Math.round(d.w * 0.8)}px;border-radius:${Math.round(d.w * 0.06)}px;box-shadow:0 12px 40px rgba(0,0,0,.45)}</style></head>
<body><h1>${caption.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h1><img src="data:image/png;base64,${shot.toString('base64')}"></body></html>`
}

async function render(html, d) {
  await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.scale, mobile: true })
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200)
  const { result } = await send('Page.getFrameTree')
  await send('Page.setDocumentContent', { frameId: result.frameTree.frame.id, html })
  // display=block keeps the caption invisible until the font is in. Wait for the
  // stylesheet first: before it arrives no font is declared and every check passes.
  await until(`(async () => {
    const css = document.querySelector('link[rel=stylesheet]')
    if (css && !css.sheet) return false
    await document.fonts.load('800 32px "Hanken Grotesk"')
    const font = [...document.fonts].some(f => f.family.includes('Hanken') && f.status === 'loaded')
    return font && (document.querySelector('img')?.complete ?? true)
  })()`)
  await sleep(300)
  return png()
}

const langs = process.argv.slice(2).length ? process.argv.slice(2) : LOCALES.map(l => l.lang)
await send('Network.setCookie', { name: 'metablend_app', value: '1', url: BASE })
await send('Network.setCookie', { name: 'metablend_consent', value: '1', url: BASE })
for (const l of LOCALES.filter(x => langs.includes(x.lang))) {
  await send('Network.setCookie', { name: 'metablend_lang', value: l.lang, url: BASE })
  for (const d of DEVICES) {
    const dir = d.out(l)
    if (!dir) continue
    mkdirSync(dir, { recursive: true })
    for (const [i, s] of SCREENS.entries()) {
      await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.scale, mobile: true })
      // map tiles and route lookups are sometimes slow: one more try before giving up
      const ready = s.ready.replace('§nearYou', t(l.lang, 'hikeNearYou')).replace('§tabWeek', t(l.lang, 'tabWeek'))
      for (let attempt = 1; ; attempt++) {
        await send('Page.navigate', { url: BASE + s.path })
        try { await until(ready, 60000); break } catch (e) {
          const seen = await ev(`location.href + ' | ' + document.body.innerText.slice(0, 160).replace(/\\s+/g, ' ')`)
          console.log(`${l.lang} ${d.id} ${i + 1}: not ready (${seen})`)
          if (attempt === 2) throw e
        }
      }
      if (s.pickTomorrow) {
        // the row of 7 day buttons on the route screen, second = tomorrow
        await ev(`[...document.querySelectorAll('[role=group]')].find(g => g.querySelectorAll('button').length === 7)?.querySelectorAll('button')[1]?.click()`)
        await sleep(5000) // that day's route weather loads
      }
      if (s.tab) {
        await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(t(l.lang, s.tab))})?.click()`)
        await sleep(1200)
      }
      await sleep(1500)
      const shot = await png()
      const out = await render(frame(CAPTIONS[l.lang][i], shot, d), d)
      const [w, h] = sizeOf(out)
      if (w !== d.w * d.scale || h !== d.h * d.scale) throw new Error(`${l.lang} ${d.id} ${i + 1}: ${w}×${h}`)
      writeFileSync(join(dir, `${i + 1}.png`), out)
      console.log(`${l.lang} ${d.id} ${i + 1} ✓`)
    }
  }
}

// Play feature graphic (1024×500) and icon (512×512), English listing only
if (langs.includes('en')) {
  const img = join(ROOT, 'fastlane/metadata/android/en-US/images')
  mkdirSync(img, { recursive: true })
  const icon = readFileSync(join(ROOT, 'public/icon-512.png'))
  const fg = { w: 1024, h: 500, scale: 1 }
  const html = `<!doctype html><html><head>${HEAD}<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&display=block" rel="stylesheet">
<style>html,body{margin:0;width:1024px;height:500px;overflow:hidden}body{background:linear-gradient(120deg,#0f1b33,#1d3a6b 60%,#3f6fb0);display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;font-family:'Hanken Grotesk',system-ui,sans-serif;color:#fff}
img{width:220px;height:220px;border-radius:48px}h1{font-size:64px;line-height:1.05;margin:0 0 16px;font-weight:800}p{font-size:30px;margin:0;color:#ffd98a;font-weight:700}</style></head>
<body><img src="data:image/png;base64,${icon.toString('base64')}"><div><h1>MetaBlend</h1><p>${t('en', 'welcomeTitle')}</p></div></body></html>`
  const out = await render(html, fg)
  if (sizeOf(out).join('×') !== '1024×500') throw new Error('feature graphic size')
  writeFileSync(join(img, 'featureGraphic.png'), out)
  copyFileSync(join(ROOT, 'public/icon-512.png'), join(img, 'icon.png'))
  console.log('feature graphic + icon ✓')
}
ws.close(); edge.kill(); process.exit(0)

// node scripts/brand/reel-shots.mjs <stage> <build folder> [base]: the stage screenshots for the reel "MetaBlend has
// a new look" (owner 2026-11-21) into store/social/reel/shots/<stage>-<screen>-<lang>.png. The same app screens from
// three local builds, one at a time: 1-before (48603a1, the last commit whose page wore the weather sky),
// 2-slate (50bc282, solid Slate before the UX changes of 20 Nov) and 3-now (main 967e434). App view, dark, de and en,
// 390 x 844 at 3x: the page at 390 x 797 under a drawn status bar that reads 18:41.
//   In the build folder: npx next build, then SELF_BASE=http://localhost:3261 npx next start -p 3261
//   Local builds only: any other host than localhost is refused, and so is a server that answers from another build
//   than the folder's (a server left over from an earlier stage would otherwise be pictured under the new name).
//   SKY=dawn puts the old weather sky's sunrise on the page (stage 1 only: there the sky followed the hour, and the
//   pictures are taken in the evening). ONLY=forecast,peak picks screens.
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from '../lib/browser.mjs'
import { blockAnalytics } from '../lib/analytics-block.mjs'
import { TERMS_CAPTURE_SCRIPT } from '../../lib/terms.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'store/social/reel/shots')
const [stage, buildDir, BASE = 'http://localhost:3261'] = process.argv.slice(2)
if (!/^[123]-(before|slate|now)$/.test(stage ?? '') || !buildDir) { console.error('usage: node scripts/brand/reel-shots.mjs <1-before|2-slate|3-now> <build folder> [base]'); process.exit(2) }
if (!/^http:\/\/localhost:\d+$/.test(BASE)) { console.error(`not a local build: ${BASE}`); process.exit(2) }
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const ONLY = process.env.ONLY?.split(',')
const SKY = process.env.SKY
const W = 390, H = 844, BAR = 47, SCALE = 3
const PLACE = 'Lienz'
// outside the featured list a peak opens by coordinates, as its link in Near you does (as in scripts/store-shots.mjs)
const PEAK = `lat=46.824&lon=12.693&elev=2057&name=Hochstein&cc=AT`

const buildId = fs.readFileSync(path.join(buildDir, '.next/BUILD_ID'), 'utf8').trim()
const home = await fetch(`${BASE}/?app=1`).then(r => r.text())
if (!home.includes(buildId)) { console.error(`${BASE} does not answer from the build in ${buildDir} (${buildId})`); process.exit(2) }
console.log(`${stage}: build ${buildId} at ${BASE}`)

fs.mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const { targets, close } = await launchBrowser(EDGE, 'reel-')
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0; const pending = new Map()
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const grab = async () => (await send('Page.captureScreenshot', { format: 'png' })).result.data

// ready: the page names what was asked for, shows a temperature, and its words stood still for 3 s
// (digits left out: the old forecast page counts down to its next update every second)
const settled = async (word, ms = 120000) => {
  let last = null, same = 0
  for (let i = 0; i < ms / 500; i++) {
    const text = await ev('document.body.innerText'), words = text?.replace(/\d/g, '')
    if (text && text.includes(word) && /\d°/.test(text) && words === last) { if (++same >= 6) return true } else same = 0
    last = words; await sleep(500)
  }
  fs.writeFileSync(path.join(OUT, `not-ready-${stage}.png`), Buffer.from(await grab(), 'base64')) // what it showed instead
  return false
}

// the phone's status bar over the page: the page's own top row drawn upwards (any background joins without a
// seam), the time on the left, reception and battery on the right
const withBar = page => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
canvas,img{display:block;width:${W}px}canvas{height:${BAR}px}img{height:${H - BAR}px}
.bar{position:absolute;left:0;top:0;width:${W}px;height:${BAR}px;color:#fff;font:600 16px/1 system-ui,'Segoe UI',sans-serif;letter-spacing:.01em}
.time{position:absolute;left:32px;top:17px}.right{position:absolute;right:26px;top:16px;display:flex;gap:6px;align-items:center}
</style></head><body><canvas width="${W * SCALE}" height="${BAR * SCALE}"></canvas><img src="data:image/png;base64,${page}">
<div class="bar"><span class="time">18:41</span><span class="right">
<svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><path d="M1.2 4.3a9.6 9.6 0 0 1 13.6 0"/><path d="M3.9 7a5.8 5.8 0 0 1 8.2 0"/><circle cx="8" cy="10" r="1.1" fill="#fff" stroke="none"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="#fff" opacity=".45"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#fff"/><path d="M25 4.5v4c.8-.3 1.5-1 1.5-2s-.7-1.700-1.500-2z" fill="#fff" opacity=".5"/></svg>
</span></div></body></html>`
const DRAW = `(async () => { const img = document.querySelector('img'); await img.decode(); const c = document.querySelector('canvas'); c.getContext('2d').drawImage(img, 0, 0, img.naturalWidth, 1, 0, 0, c.width, c.height); return true })()`

// The pages are pictured first and get their status bar at the end: drawing the bar replaces the document,
// and a page that is still needed for its next tab must not be replaced.
const pages = []
const save = async name => {
  // the cookie notice (the old versions show it in the app too) is answered, as a reader would have
  await ev(`([...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'OK')?.click(), true)`)
  if (SKY) await ev(`(document.documentElement.dataset.sky = ${JSON.stringify(SKY)}, true)`)
  await ev(`(scrollTo({ top: 0, behavior: 'instant' }), document.activeElement?.blur?.(), true)`); await sleep(SKY ? 2600 : 600) // the sky fades in over 1.8 s
  pages.push([name, await grab()])
}
const drawBars = async () => {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: true })
  for (const [name, page] of pages) {
    const { frameTree } = (await send('Page.getFrameTree')).result
    await send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: withBar(page) })
    if (!(await ev(DRAW))) throw new Error(`${name}: the status bar was not drawn`)
    await sleep(300)
    fs.writeFileSync(path.join(OUT, `${stage}-${name}.png`), Buffer.from(await grab(), 'base64'))
    console.log(`${stage}-${name} ✓`)
  }
}

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await blockAnalytics(ws, send)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: TERMS_CAPTURE_SCRIPT })
  const { userAgent } = (await send('Browser.getVersion')).result
  await send('Network.setUserAgentOverride', { userAgent: `${userAgent} MetaBlendApp` })
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H - BAR, deviceScaleFactor: SCALE, mobile: true })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  const open = async (lang, url, fresh = true) => {
    if (fresh) { await send('Network.clearBrowserCookies'); await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }) }
    for (const [k, v] of [['metablend_lang', lang], ['metablend_theme', 'dark'], ['metablend_app', '1']]) await send('Network.setCookie', { name: k, value: v, url: BASE + '/' })
    await send('Page.navigate', { url: BASE + url })
  }
  const want = screen => !ONLY || ONLY.includes(screen)
  for (const lang of ['en', 'de']) {
    if (want('forecast')) {
      await open(lang, `/?city=${encodeURIComponent(PLACE)}&app=1`)
      if (!(await settled(PLACE))) throw new Error(`${lang}: the forecast for ${PLACE} did not load`)
      // the search field stays empty, as on the store screenshots
      await ev(`(() => { const i = document.querySelector('.home-search input, input[type=search], input[type=text]'); if (i) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur() } return true })()`)
      await sleep(1500)
      console.log(`  ${lang} forecast: ${(await ev('document.body.innerText')).replace(/\s+/g, ' ').slice(0, 260)}`)
      await save(`forecast-${lang}`)
    }
    if (want('peak')) {
      await open(lang, `/hike?${PEAK}&app=1`)
      if (!(await settled('Hochstein'))) throw new Error(`${lang}: the peak did not load`)
      await sleep(2500)
      // Tomorrow and Week by their own tabs: which tab the page opens on depends on the hour (in the evening
      // Today has no start left), and every stage has to show the same one
      const tabs = await ev(`[...document.querySelectorAll('[role=tab]')].map(b => b.textContent.trim())`)
      if (tabs?.length !== 3) throw new Error(`${lang}: the peak page shows the tabs ${JSON.stringify(tabs)}, not three`)
      for (const [i, name] of [[1, 'tomorrow'], [2, 'week']]) {
        await ev(`([...document.querySelectorAll('[role=tab]')][${i}].click(), true)`); await sleep(2500)
        console.log(`  ${lang} peak, tab "${tabs[i]}": ${(await ev('document.body.innerText')).replace(/\s+/g, ' ').slice(0, 200)}`)
        await save(`peak-${name}-${lang}`)
      }
    }
    // the first screen of a phone that has never opened the app (stage 3's own change)
    if (want('first') && stage === '3-now') {
      await open(lang, '/?app=1')
      if (!(await settled(''))) throw new Error(`${lang}: the first screen did not load`)
      await sleep(1500)
      await save(`first-start-${lang}`)
    }
  }
  await drawBars()
} finally {
  await close()
}

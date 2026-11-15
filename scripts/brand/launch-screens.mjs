// node scripts/brand/launch-screens.mjs: the real app screens for the launch carousel (owner 2026-11-15, posted on
// 15 December), into store/social/launch-2026-12-15/screens/: the forecast for Lienz and a peak right above it with a
// favourable summit window, app view, dark theme, de and en, 390 x 844 at 3x. The audience is mostly Osttirol.
//   Read-only page loads on production (https://metablend.app), analytics blocked, like the other captures.
//   Run it in the morning, Alps time: the peak needs a window today. Hochstein first, Spitzkofel when Hochstein has
//   none (owner 2026-11-15); neither: it stops and says so. TOMORROW=1 also accepts the Tomorrow tab.
//   PLACE=… and MIN_SOURCES=… change the forecast's place and how many sources must be in (default 18).
// Then: node scripts/brand/launch-slides.mjs
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from '../lib/browser.mjs'
import { blockAnalytics } from '../lib/analytics-block.mjs'
import { TERMS_CAPTURE_SCRIPT } from '../../lib/terms.js'
import { t } from '../../lib/i18n.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'store/social/launch-2026-12-15/screens')
const BASE = 'https://metablend.app'
const PLACE = process.env.PLACE ?? 'Lienz'
const MIN_SOURCES = Number(process.env.MIN_SOURCES ?? 18)
// outside the featured list a peak opens by coordinates, as its link in Near you does (as in scripts/store-shots.mjs)
const near = (name, lat, lon, elev) => `lat=${lat}&lon=${lon}&elev=${elev}&name=${encodeURIComponent(name)}&cc=AT`
const PEAKS = [['Hochstein', near('Hochstein', 46.824, 12.693, 2057)], ['Spitzkofel', near('Spitzkofel', 46.772, 12.743, 2717)]]
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

fs.mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const { targets, close } = await launchBrowser(EDGE, 'launch-')
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0; const pending = new Map()
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const until = async (x, ms = 60000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(x)) return true; await sleep(250) } return false }
const shot = async name => { const { result } = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(result.data, 'base64')); console.log(name, '✓') }
let peak = null
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await blockAnalytics(ws, send)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: TERMS_CAPTURE_SCRIPT })
  const { userAgent } = (await send('Browser.getVersion')).result
  await send('Network.setUserAgentOverride', { userAgent: `${userAgent} MetaBlendApp` })
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  for (const lang of ['de', 'en']) {
    const prep = async () => {
      await send('Network.clearBrowserCookies'); await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' })
      for (const [k, v] of [['metablend_lang', lang], ['metablend_theme', 'dark'], ['metablend_app', '1']]) await send('Network.setCookie', { name: k, value: v, url: BASE + '/' })
    }
    // the forecast, with every source in (the Sources fold's count), the search field empty as on the store screenshots
    await prep()
    await send('Page.navigate', { url: `${BASE}/?city=${encodeURIComponent(PLACE)}&app=1` })
    const fold = JSON.stringify(t(lang, 'sourcesFold'))
    if (!(await until(`!!document.querySelector('.text-7xl') && (+([...document.querySelectorAll('button')].find(b => b.textContent.includes(${fold}))?.textContent.match(/(\\d+)\\s/)?.[1] ?? 0)) >= ${MIN_SOURCES}`, 90000))) throw new Error(`${lang}: the forecast for ${PLACE} did not show ${MIN_SOURCES} sources`)
    await ev(`(() => { const i = document.querySelector('.home-search input'); if (i) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur() } scrollTo({ top: 0, behavior: 'instant' }) })()`)
    await sleep(2000); await shot(`forecast-${lang}`)
    // the peak: the same one in both languages, never "No favourable summit window"
    const none = JSON.stringify(t(lang, 'swNone').split('{day}')[0].trim())
    for (const [name, query] of peak ? [peak] : PEAKS) {
      await prep()
      await send('Page.navigate', { url: `${BASE}/hike?${query}&app=1` })
      if (!(await until(`!!document.querySelector('[role=region][aria-label]') && document.querySelectorAll('svg').length > 3`, 60000))) { console.log(name, 'did not load'); continue }
      await sleep(2500)
      if (process.env.TOMORROW && await ev(`document.body.innerText.includes(${none})`)) { await ev(`([...document.querySelectorAll('[role=tab]')][1]?.click(), true)`); await sleep(1500) }
      if (await ev(`document.body.innerText.includes(${none})`)) { console.log(name, 'has no favourable summit window'); continue }
      await ev(`(scrollTo({ top: 0, behavior: 'instant' }), true)`); await sleep(400)
      peak = [name, query]; await shot(`summit-${lang}`); break
    }
    if (!peak) throw new Error('neither Hochstein nor Spitzkofel has a favourable summit window: try another morning (or TOMORROW=1 with the owner\'s say)')
  }
  console.log(`place ${PLACE}, peak ${peak[0]}`)
} finally { ws.close(); await close() }

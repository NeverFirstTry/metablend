// Captioned store screenshots from a local production build, every language:
//   npx next build && SELF_BASE=https://metablend.app npx next start -p 3123   (separate terminal;
//   SELF_BASE: where the start page's server render fetches the forecast. Production's cached API keeps
//   this machine off the forecast providers; http://localhost:3123 works too, but calls them all itself)
//   On a Mac, scripts/store-run.sh does all of it for the morning run.
//   node scripts/store-shots.mjs [lang …]         (default: all 13; DATA=https://metablend.app takes the /api/ answers from there)
//   SHOTS=1,3 node scripts/store-shots.mjs        (only those screens; add 'feature' for the Play feature graphic)
// Writes fastlane/screenshots/<ios>/ (1290×2796) and
// fastlane/metadata/android/<android>/images/phoneScreenshots/ (1080×1920),
// plus the Play feature graphic and icon in en-US.
// Screens 4 and 5 show the feature working with real data: run them in the morning (Alps time),
// when a candidate peak has an open summit window today; the script stops if none has.
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCALES } from '../store/locales.js'
import { t } from '../lib/i18n.js'
import { captionProblems } from '../lib/wording.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE ?? 'http://localhost:3123'
const PORT = 9371
const CAPTIONS = JSON.parse(readFileSync(join(ROOT, 'store/captions.json'), 'utf8'))
// no dash, no safety, no reliability or accuracy claim, no word that also means cheap (lib/wording.js)
const problems = captionProblems(CAPTIONS)
if (problems.length) { console.error(`store/captions.json:\n  ${problems.join('\n  ')}`); process.exit(1) }
// the hiking screens stand in Lienz: the near-you list shows the Alps, not the Vienna hills
const LIENZ = { latitude: 46.8289, longitude: 12.7693, accuracy: 50 }
// screens 4 and 5: the first of these with an open summit window today and a favourable start
// Screens 4 and 5: the first of these with an open summit window today and a route with a favourable start.
// The peaks right above Lienz first (screen 3 stands there), lowest first, then the big three. Peaks outside
// the featured list open by coordinates, as their links in Near you do; routes are the peak's day routes
// from /api/routes (Hochstein's 48 and 54 km multi-day ones left out).
const near = (name, lat, lon, elev) => `lat=${lat}&lon=${lon}&elev=${elev}&name=${encodeURIComponent(name)}&cc=AT`
const CANDIDATES = [
  ['Hochstein', near('Hochstein', 46.824, 12.693, 2057), ['osm-19470523']],
  ['Spitzkofel', near('Spitzkofel', 46.772, 12.743, 2717), ['osm-7382272']],
  ['Schleinitz', near('Schleinitz', 46.896, 12.749, 2904), ['osm-14550388']],
  ['Hoher Prijakt', near('Hoher Prijakt', 46.916, 12.712, 3064), ['osm-6032637']],
  ['Petzeck', near('Petzeck', 46.948, 12.804, 3283), ['osm-16253220']],
  ['Großglockner', 'peak=grossglockner', ['osm-14622955', 'osm-14622970']],
  ['Großvenediger', 'peak=grossvenediger', ['osm-1165548', 'osm-193073']],
  ['Zugspitze', 'peak=zugspitze', ['osm-3201006', 'osm-33856']],
]
let PICK = null
const DEVICES = [
  { id: 'ios', w: 430, h: 932, scale: 3, out: l => l.ios && join(ROOT, 'fastlane/screenshots', l.ios) },
  { id: 'android', w: 360, h: 640, scale: 3, out: l => join(ROOT, 'fastlane/metadata/android', l.android, 'images/phoneScreenshots') },
]
const FORECAST_READY = `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '§tabWeek') && !document.documentElement.dataset.localizing`
const SOURCES_IN = `(+([...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify('§sourcesFold')}))?.querySelector('.block')?.textContent.match(/\\d+/)?.[0] ?? 0) >= 18)`
const PEAK_READY = `!!document.querySelector('[role=region][aria-label]') && document.querySelectorAll('svg').length > 3` // the hour strip, in any language (French says CAS, not SAC)
const ROUTE_READY = `!!document.querySelector('.leaflet-container') && document.body.innerText.includes(':')`
// the route screen's row of 7 day buttons: 0 = today, 1 = tomorrow
const clickDay = n => `[...document.querySelectorAll('[role=group]')].find(g => g.querySelectorAll('button').length === 7)?.querySelectorAll('button')[${n}]?.click()`
// a "{day}" template's longest literal part in this language: on the page means that state shows
const stateText = (lang, key) => t(lang, key).split('{day}').map(s => s.trim()).sort((a, b) => b.length - a.length)[0]
const shows = (lang, key) => `document.body.innerText.includes(${JSON.stringify(stateText(lang, key))})`
const SCREENS = [
  // Ready = the range tabs are there (not a text length: Japanese / Chinese /
  // Korean pages are short). The app remembers the last tab, so both forecast
  // shots pick theirs: Today, then Week.
  // ...and every source is in: the Sources fold says at least 18 (a slow source otherwise leaves 10)
  { path: '/?city=Vienna', ready: `${FORECAST_READY} && ${SOURCES_IN}`, tab: 'tabToday', clearSearch: true },
  { path: '/?city=Vienna', ready: `${FORECAST_READY} && ${SOURCES_IN}`, tab: 'tabWeek', clearSearch: true },
  // Near you's list is in (not "looking…"): the device stands in Lienz (location allowed, no last
  // city), answered from store/near-lienz.json, the production answer for that cell; this PC's own
  // lookups can be throttled by the public geocoder
  { path: '/hike', clearStorage: true, ready: `document.querySelectorAll('button[aria-expanded]').length > 0 && [...document.querySelectorAll('section')].some(x => x.innerText.includes(${JSON.stringify('§nearYou')}) && x.querySelector('a'))` },
  { path: () => `/hike?${PICK.query}`, ready: PEAK_READY, notState: 'swNone' },
  { path: () => `/hike?${PICK.query}&route=${PICK.route}`, ready: ROUTE_READY, notState: 'routeNoStart', day: true },
]
const sleep = ms => new Promise(r => setTimeout(r, ms))
// The Android set in an Android phone's fonts. The site's stack starts with Apple's fonts, which Android
// lacks, so a phone shows Hanken Grotesk (the site's own), Noto Sans CJK for Japanese, Chinese and Korean,
// and Roboto behind them. On a Mac the stack would pick SF Pro, so the Android shots drop Apple's fonts
// and load Noto and Roboto for the capture only. The iPhone set keeps the stack (SF Pro on a Mac; on
// Windows it falls back to Hanken Grotesk, so take the iPhone set on a Mac).
const NOTO = { ja: 'Noto Sans JP', zh: 'Noto Sans SC', ko: 'Noto Sans KR' }
const SAMPLE = { ja: 'あ', zh: '中', ko: '한' }
const androidFonts = lang => {
  const cjk = NOTO[lang], families = ['Roboto', ...(cjk ? [cjk] : [])]
  const href = `https://fonts.googleapis.com/css2?${families.map(x => `family=${x.replace(/ /g, '+')}:wght@100..900`).join('&')}&display=block`
  const stack = `var(--font-hanken), ${cjk ? `"${cjk}", ` : ''}Roboto, sans-serif`
  return `(async () => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: ${JSON.stringify(href)} })
    await new Promise(r => { link.onload = link.onerror = r; document.head.append(link) })
    const style = document.createElement('style'); style.textContent = ':root { --font-ui: ' + ${JSON.stringify(stack)} + ' !important }'; document.head.append(style)
    void document.body.offsetHeight
    await Promise.all([document.fonts.load('400 16px Roboto'), ${cjk ? `document.fonts.load('400 16px "${cjk}"', ${JSON.stringify(SAMPLE[lang])})` : 'null'}])
    await document.fonts.ready
    return [...document.fonts].some(f => f.family.replace(/"/g, '') === ${JSON.stringify(cjk ?? 'Roboto')} && f.status === 'loaded')
  })()`
}

const prof = mkdtempSync(join(tmpdir(), 'storeshots-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
// however the run ends (a screen that never got ready throws), the browser goes with it: a leftover
// would keep the debugging port, and the next try (scripts/store-run.sh) would talk to it
process.on('exit', () => { edge.kill(); try { if (DATA) console.log(`production API: ${api.sent} requests sent, ${api.reused} answered again from this run`) } catch {} })
let targets
for (let i = 0; i < 40 && !targets; i++) { await sleep(250); targets = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json()).catch(() => null) }
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
const NEAR = readFileSync(join(ROOT, 'store/near-lienz.json'))
// DATA=https://metablend.app: the app's /api/ answers come live from there (every source, CDN-cached),
// the pages from the local build. A PC that has captured all day gets rate-limited by Open-Meteo and
// its forecasts drop to a handful of sources; the shots must show the full set.
const DATA = process.env.DATA ?? null
// Gentle on production and the forecast providers behind it: every answer is asked for once per run and
// reused by every language and device that asks the same (POST bodies included; a language in the URL
// keeps its own answer), and production gets one request at a time with a short gap. A screen that is
// not ready drops the reused answers before its next try, so a bad answer is never repeated.
const answers = new Map()
const api = { sent: 0, reused: 0 }
let lane = Promise.resolve()
const oneAtATime = job => { const p = lane.then(job); lane = p.catch(() => {}).then(() => sleep(300)); return p }
async function fromData({ requestId, request }) {
  const u = new URL(request.url)
  const key = `${request.method} ${u.pathname}${u.search} ${request.postData ?? ''}`
  let answer = answers.get(key)
  if (answer) api.reused++
  else {
    answer = oneAtATime(async () => {
      api.sent++
      const r = await fetch(DATA + u.pathname + u.search, { method: request.method, headers: { 'content-type': 'application/json' }, body: request.postData })
      if (!r.ok) throw new Error(String(r.status))
      return { type: r.headers.get('content-type') ?? 'application/json', body: Buffer.from(await r.arrayBuffer()).toString('base64') }
    })
    answers.set(key, answer)
  }
  try {
    const { type, body } = await answer
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: type }], body })
  } catch (e) {
    answers.delete(key)
    console.log(`DATA ${u.pathname}: ${e.message}, answered locally`)
    await send('Fetch.continueRequest', { requestId })
  }
}
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method !== 'Fetch.requestPaused') return
  if (m.params.request.url.includes('/api/peaks/near')) send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: NEAR.toString('base64') })
  else fromData(m.params)
})
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const until = async (expr, ms = 30000) => { for (let s = 0; s < ms; s += 250) { if (await ev(expr)) return true; await sleep(250) } throw new Error(`timeout: ${expr}`) }
const png = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64')
const sizeOf = buf => [buf.readUInt32BE(16), buf.readUInt32BE(20)]
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/peaks/near*' }, ...(DATA ? [{ urlPattern: '*/api/*' }] : [])] })
// location allowed and standing in Lienz (the hiking screens); the forecast screens open Vienna by link
await send('Browser.grantPermissions', { origin: new URL(BASE).origin, permissions: ['geolocation'] })
await send('Emulation.setGeolocationOverride', LIENZ)

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
  // a caption longer than three lines pushes the phone shot down too far
  const lines = await ev(`(() => { const h = document.querySelector('h1'); return Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)) })()`)
  if (lines > 3) throw new Error(`caption takes ${lines} lines: ${await ev(`document.querySelector('h1').textContent`)}`)
  return png()
}

const langs = process.argv.slice(2).length ? process.argv.slice(2) : LOCALES.map(l => l.lang)
const shotList = process.env.SHOTS ? process.env.SHOTS.split(',') : null
const only = shotList && shotList.filter(x => /^\d+$/.test(x)).map(Number)
const wantFeature = !shotList || shotList.includes('feature')
await send('Network.setCookie', { name: 'metablend_app', value: '1', url: BASE })
await send('Network.setCookie', { name: 'metablend_consent', value: '1', url: BASE })

// Screens 4 and 5: find a peak with an open summit window today and a route with a favourable start
// today or tomorrow, in English first; every language then uses the same choice
if (!only || only.some(n => n >= 4)) {
  await send('Network.setCookie', { name: 'metablend_lang', value: 'en', url: BASE })
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true })
  const open = async (path, ready) => { await send('Page.navigate', { url: BASE + path }); try { await until(ready, 60000); return true } catch { return false } }
  for (const [peak, query, routes] of CANDIDATES) {
    if (!(await open(`/hike?${query}`, PEAK_READY))) { console.log(`${peak}: page not ready`); continue }
    await sleep(2000)
    if (await ev(shows('en', 'swNone'))) { console.log(`${peak}: no favourable summit window today`); continue }
    for (const route of routes) {
      if (!(await open(`/hike?${query}&route=${route}`, ROUTE_READY))) { console.log(`${peak} ${route}: route not ready`); continue }
      await sleep(5000) // the route's weather loads
      for (const day of [0, 1]) {
        if (day) { await ev(clickDay(1)); await sleep(5000) }
        if (!(await ev(shows('en', 'routeNoStart')))) { PICK = { peak, query, route, day }; break }
      }
      if (PICK) break
      console.log(`${peak} ${route}: no favourable start today or tomorrow`)
    }
    if (PICK) break
  }
  if (!PICK) {
    console.error('No candidate peak has an open summit window today and a favourable start: capture screens 4 and 5 another morning.')
    // 3, not 1: scripts/store-run.sh tries again later for this, but not for a failure
    ws.close(); edge.kill(); process.exit(3)
  }
  console.log(`screens 4 and 5: ${PICK.peak}, route ${PICK.route}, start ${PICK.day ? 'tomorrow' : 'today'}`)
}

for (const l of LOCALES.filter(x => langs.includes(x.lang))) {
  await send('Network.setCookie', { name: 'metablend_lang', value: l.lang, url: BASE })
  for (const d of DEVICES) {
    const dir = d.out(l)
    if (!dir) continue
    mkdirSync(dir, { recursive: true })
    for (const [i, s] of SCREENS.entries()) {
      if (only && !only.includes(i + 1)) continue
      await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.scale, mobile: true })
      // map tiles, route lookups and a slow source are sometimes late: up to three tries
      const ready = s.ready.replace('§nearYou', t(l.lang, 'hikeNearYou')).replace('§tabWeek', t(l.lang, 'tabWeek')).replace('§sourcesFold', t(l.lang, 'sourcesFold'))
      const path = typeof s.path === 'function' ? s.path() : s.path
      for (let attempt = 1; ; attempt++) {
        // no last city on the hiking screen: the list comes from where the device stands (Lienz)
        if (s.clearStorage) await send('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'local_storage' })
        await send('Page.navigate', { url: BASE + path })
        try { await until(ready, 60000); break } catch (e) {
          const seen = await ev(`location.href + ' | ' + document.body.innerText.slice(0, 160).replace(/\\s+/g, ' ')`)
          console.log(`${l.lang} ${d.id} ${i + 1}: not ready (${seen})`)
          answers.clear()
          if (attempt === 3) throw e
        }
      }
      if (s.day) {
        await sleep(5000) // the route's weather loads
        if (PICK.day) { await ev(clickDay(PICK.day)); await sleep(5000) }
      }
      if (s.tab) {
        await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(t(l.lang, s.tab))})?.click()`)
        await sleep(1200)
      }
      // the search field stays empty: its placeholder is in the listing's language
      if (s.clearSearch) {
        await ev(`(() => { const i = document.querySelector('.home-search input'); if (!i) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur() })()`)
      }
      if (d.id === 'android' && !(await ev(androidFonts(l.lang)))) throw new Error(`${l.lang} ${d.id} ${i + 1}: Android fonts did not load`)
      await sleep(1500)
      // the store shows the feature working: never "No favourable summit window" or "No favourable start"
      if (s.notState && await ev(shows(l.lang, s.notState))) throw new Error(`${l.lang} ${d.id} ${i + 1}: shows "${stateText(l.lang, s.notState)}"`)
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
if (langs.includes('en') && wantFeature) {
  const img = join(ROOT, 'fastlane/metadata/android/en-US/images')
  mkdirSync(img, { recursive: true })
  const icon = readFileSync(join(ROOT, 'public/icon-512.png'))
  const fg = { w: 1024, h: 500, scale: 1 }
  const html = `<!doctype html><html><head>${HEAD}<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&display=block" rel="stylesheet">
<style>html,body{margin:0;width:1024px;height:500px;overflow:hidden}body{background:linear-gradient(120deg,#0f1b33,#1d3a6b 60%,#3f6fb0);display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;font-family:'Hanken Grotesk',system-ui,sans-serif;color:#fff}
img{width:220px;height:220px;border-radius:48px}h1{font-size:64px;line-height:1.05;margin:0 0 16px;font-weight:800}p{font-size:30px;margin:0;color:#ffd98a;font-weight:700}</style></head>
<body><img src="data:image/png;base64,${icon.toString('base64')}"><div><h1>MetaBlend</h1><p>${t('en', 'tagline')}</p></div></body></html>`
  const out = await render(html, fg)
  if (sizeOf(out).join('×') !== '1024×500') throw new Error('feature graphic size')
  writeFileSync(join(img, 'featureGraphic.png'), out)
  copyFileSync(join(ROOT, 'public/icon-512.png'), join(img, 'icon.png'))
  console.log('feature graphic + icon ✓')
}
ws.close(); edge.kill(); process.exit(0)

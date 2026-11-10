// Phone layout check, website and app, at 390 px: every page fits the screen (nothing scrolls the
// page sideways; a wide row scrolls inside its own container) and no visible text is below 13 px.
//   npx next build && SELF_BASE=http://localhost:3123 npx next start -p 3123   (separate terminal)
//   node scripts/check-phone-layout.mjs [base]          (default http://localhost:3123)
//   DATA=https://metablend.app node scripts/check-phone-layout.mjs   (the pages' /api/ answers from there,
//   when Open-Meteo rate-limits this PC). Exits 1 and names the cause on any finding.
// Runs each page with and without reduced motion (the peak page's overflow showed only with it),
// every fold open, in German (long words). Only fixed places, so after the first load every answer
// comes from the CDN: the forecast for Wien, Großglockner and one of its routes, airport LOWW.
// The check is no visitor: it sends its own user agent (…MetaBlendLayoutCheck/1) and blocks the
// analytics (Plausible, Vercel Web Analytics and Speed Insights), and fails if any of them got through.
// In CI (.github/workflows/phone-layout.yml) it runs against metablend.app after every production
// deploy of a push to main, with EDGE=/usr/bin/google-chrome.
// The app pages and the website pages each run in a fresh browser context, and the browser picks its own
// debugging port, so neither another view nor another run on the same machine can leak into a page.
// A call to the browser has 45 s, a page 2 minutes and the run 20 minutes: a hang fails fast and names the page.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:3123'
const DATA = process.env.DATA ?? null
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const WIDTH = 390
// [name, path, how]: 'search' opens the forecast by searching Wien; 'week' then opens the Week tab
const PAGES = [
  ['forecast', '/', 'search'], ['forecast week', '/', 'week'],
  ['hiking', '/hike'], ['peak', '/hike?peak=grossglockner'], ['route', '/hike?peak=grossglockner&route=osm-14622955'],
  ['more', '/more'], ['rankings', '/leaderboard'], ['planner', '/planner'], ['heatmap', '/heatmap'],
  ['aviation', '/aviation'], ['airport', '/aviation/LOWW'], ['summit page', '/mountains/grossglockner'],
  ['city page', '/weather/vienna'], ['privacy', '/privacy'], ['terms', '/terms'], ['impressum', '/impressum'], ['support', '/support'],
]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const visible = sel => `[...document.querySelectorAll(${JSON.stringify(sel)})].some(e => e.getClientRects().length > 0)`
const ANALYTICS = ['*plausible.io/*', '*/_vercel/insights/*', '*/_vercel/speed-insights/*', '*va.vercel-scripts.com/*', '*vitals.vercel-insights.com/*']
const IS_ANALYTICS = /plausible\.io\/|\/_vercel\/(speed-)?insights\/|va\.vercel-scripts\.com|vitals\.vercel-insights\.com/
const analytics = { blocked: 0, sent: 0 }
// The browser: a free debugging port of its own (port 0: the browser picks one and writes it into
// DevToolsActivePort in its profile), so two runs at once never drive each other's browser (two sessions
// shared the fixed port 9441 on 2026-11-10; one run stalled, one saw a website page "opened as the app").
const profile = mkdtempSync(join(tmpdir(), 'layout-'))
const edge = spawn(EDGE, ['--headless=new', ...(process.env.CI ? ['--no-sandbox'] : []), '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
const gone = new Promise(r => edge.once('exit', r))
let active = null
// up to 30 s: on a busy CI runner the browser took longer than the 10 s this waited before (run 29, 2026-11-10)
for (let i = 0; i < 120 && !active; i++) {
  await sleep(250)
  try { const [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n'); if (port && path) active = `ws://127.0.0.1:${port.trim()}${path.trim()}` } catch { /* not written yet */ }
}
if (!active) { console.error('The browser did not open its debugging port within 30 seconds: no page was checked.'); edge.kill(); process.exit(1) }
console.log(`browser on debugging port ${new URL(active).port}`)

// Time limits, so a stuck browser fails fast and names the page instead of running on: every browser
// call 45 s, a page 2 minutes (which stops the run), the whole run 20 minutes: a full run takes 6 to 6.5 minutes
// on CI (346 to 380 s, 27 runs to 2026-11-10) and about 5 on a PC through DATA (315 s, also with a second run at once).
const CALL_LIMIT = 45_000, PAGE_LIMIT = 120_000, RUN_LIMIT = 20 * 60_000
let current = 'starting the browser'
const runTimer = setTimeout(async () => { console.error(`\nThe run took longer than ${RUN_LIMIT / 60_000} minutes, at ${current}.`); await closeBrowser(); process.exit(1) }, RUN_LIMIT)

// one DevTools connection per target; events go to the handler of that connection
function connect(url, onEvent = () => {}) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } else if (m.method) onEvent(m)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id
    const timer = setTimeout(() => { pending.delete(n); reject(new Error(`${method} had no answer within ${CALL_LIMIT / 1000} s`)) }, CALL_LIMIT)
    pending.set(n, m => { clearTimeout(timer); resolve(m) })
    ws.send(JSON.stringify({ id: n, method, params }))
  })
  return { ws, call, open: new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject) }) }
}
const browser = connect(active)
await browser.open
// Closed over DevTools, the browser ends its helpers and frees its profile (about 400 MB), which then goes. A killed
// browser's helpers keep the files locked for a while; 34 profiles had piled up in TEMP by 2026-11-10.
async function closeBrowser() {
  try { browser.ws.send(JSON.stringify({ id: 0, method: 'Browser.close' })) } catch { /* connection already gone */ }
  await Promise.race([gone, sleep(5000)])
  edge.kill()
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* a file still locked stays behind */ }
}
// the page connection of the view being checked
let send = null
async function fromData({ requestId, request }) {
  const u = new URL(request.url)
  try {
    const r = await fetch(DATA + u.pathname + u.search, { method: request.method, headers: { 'content-type': 'application/json' }, body: request.postData })
    if (!r.ok) throw new Error(String(r.status))
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: r.headers.get('content-type') ?? 'application/json' }], body: Buffer.from(await r.arrayBuffer()).toString('base64') })
  } catch { await send('Fetch.continueRequest', { requestId }).catch(() => {}) }
}
const onEvent = m => {
  if (m.method === 'Fetch.requestPaused') fromData(m.params)
  if (m.method === 'Network.loadingFailed' && m.params.blockedReason === 'inspector') analytics.blocked++
  if (m.method === 'Network.responseReceived' && IS_ANALYTICS.test(m.params.response.url)) analytics.sent++
}
// A view (app or website) in a fresh browser context: its own cookies, storage, session storage and cache,
// so nothing the app pages set (the app flag) reaches the website pages.
async function openView() {
  const { result: { browserContextId } } = await browser.call('Target.createBrowserContext', { disposeOnDetach: true })
  const { result: { targetId } } = await browser.call('Target.createTarget', { url: 'about:blank', browserContextId })
  const page = connect(active.replace(/\/devtools\/browser\/.*$/, `/devtools/page/${targetId}`), onEvent)
  await page.open
  send = page.call
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  const { userAgent } = (await browser.call('Browser.getVersion')).result
  await send('Network.setUserAgentOverride', { userAgent: `${userAgent} MetaBlendLayoutCheck/1` })
  await send('Network.setBlockedURLs', { urls: ANALYTICS })
  if (DATA) await send('Fetch.enable', { patterns: [{ urlPattern: `${BASE}/api/*` }] })
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 844, deviceScaleFactor: 1, mobile: true })
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  return async () => { page.ws.close(); await browser.call('Target.disposeBrowserContext', { browserContextId }).catch(() => {}) }
}
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const until = async (expr, ms = 60000) => { for (let s = 0; s < ms; s += 250) { if (await ev(expr)) return true; await sleep(250) } return false }

// visible text below 13 px, grouped by element class
const SMALL = `(() => {
  const out = new Map(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement, s = n.textContent.trim()
    if (!s || !el || el.closest('.sr-only, script, style, noscript, [hidden]') || !el.getClientRects().length) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || parseFloat(cs.fontSize) >= 12.95) continue
    const key = cs.fontSize + ' ' + String(el.className?.baseVal ?? el.className ?? '').slice(0, 60)
    if (!out.has(key)) out.set(key, s.slice(0, 40))
  }
  return [...out].map(([k, v]) => k + ' "' + v + '"')
})()`
// the page wider than the screen: walk down from <body>, each step into the one child whose removal
// makes the page fit, and name the deepest (absolutely placed children, e.g. screen-reader text,
// escape a scroller that isn't positioned, so a scan of element rectangles misses them)
const WIDE = `(() => {
  const W = innerWidth, doc = document.documentElement
  if (doc.scrollWidth <= W) return null
  const fitsWithout = el => { const d = el.style.display; el.style.display = 'none'; const ok = doc.scrollWidth <= W; el.style.display = d; return ok }
  let cause = null
  for (let node = document.body, next; node; node = next) {
    next = [...node.children].find(fitsWithout) ?? null
    if (next) cause = next
  }
  const path = []
  for (let a = cause; a && a !== document.body && path.length < 4; a = a.parentElement) path.unshift(a.tagName.toLowerCase() + (typeof a.className === 'string' && a.className ? '.' + a.className.trim().split(/\\s+/).slice(0, 4).join('.') : ''))
  return doc.scrollWidth + ' px wide; cause: ' + (cause ? path.join(' > ') : 'not found')
})()`

// one page in one view and motion setting; findings go into the list
async function checkPage(view, motion, name, path, how) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: motion }] })
  await send('Network.clearBrowserCookies')
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' })
  for (const [k, v] of [['metablend_lang', 'de'], ['metablend_consent', '1']]) await send('Network.setCookie', { name: k, value: v, url: BASE + '/' })
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200)
  // the app's forecast is its first tab; it opens from another page, like the app itself
  const start = view === 'app' && how ? '/more' : path
  // a page that never answers stops the run with its name (send throws after 45 s); an error page is a finding
  const nav = await send('Page.navigate', { url: BASE + start + (view === 'app' ? (start.includes('?') ? '&' : '?') + 'app=1' : '') })
  if (nav.error || nav.result?.errorText) throw new Error(`did not load: ${nav.error?.message ?? nav.result.errorText}`)
  await until(view === 'app' ? visible('.app-tabbar a') : 'document.readyState === "complete"')
  if (how) {
    if (view === 'app') await ev(`document.querySelector('.app-tabbar a').click()`)
    await until(visible('.home-search input'))
    await ev(`(() => { const i = document.querySelector('.home-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Wien'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true })()`)
    await until(`${visible('[role=list] [role=listitem]')} && ${visible('.text-7xl')}`)
    if (how === 'week') { await ev(`[...document.querySelectorAll('[role=tab]')].at(-1).click()`); await sleep(1000) }
  }
  await sleep(3500)
  await ev(`(document.querySelectorAll('details:not([open])').forEach(d => d.open = true), true)`); await sleep(500)
  const label = `${view} ${name}${motion === 'reduce' ? ' (reduced motion)' : ''}`
  const app = await ev('document.documentElement.dataset.app === "1"')
  if (app !== (view === 'app')) { findings.push(`${label}: opened as the ${app ? 'app' : 'website'}`); return }
  const wide = await ev(WIDE)
  if (wide) findings.push(`${label}: ${wide}`)
  for (const s of motion === 'reduce' ? await ev(SMALL) : []) findings.push(`${label}: text below 13 px: ${s}`)
  console.log(`${wide ? '✗' : '✓'} ${label}`)
}

const findings = []
let checked = 0
const started = Date.now()
try {
  views: for (const view of ['app', 'website']) {
    const close = await openView()
    try {
      for (const motion of ['reduce', 'no-preference']) for (const [name, path, how] of PAGES) {
        current = `${view} ${name}${motion === 'reduce' ? ' (reduced motion)' : ''}`
        let timer
        const outcome = await Promise.race([
          checkPage(view, motion, name, path, how).then(() => 'done', e => `failed: ${e.message}`),
          new Promise(r => { timer = setTimeout(() => r('timeout'), PAGE_LIMIT) }),
        ])
        clearTimeout(timer)
        checked++
        if (outcome === 'done') continue
        // a stuck page ends the run: what follows would only wait on the same browser
        findings.push(`${current}: ${outcome === 'timeout' ? `no result within ${PAGE_LIMIT / 1000} s` : outcome}; the run stopped here`)
        console.log(`✗ ${current}`)
        break views
      }
    } finally { await close() }
  }
} finally { clearTimeout(runTimer); await closeBrowser() }
const took = `${Math.round((Date.now() - started) / 1000)} s`
console.log(`analytics: ${analytics.blocked} requests blocked, ${analytics.sent} reached their service`)
if (analytics.sent) findings.push(`analytics: ${analytics.sent} requests reached Plausible or Vercel; the check would count as visits`)
if (findings.length) { console.log(`\n${findings.length} finding(s) in ${checked} page checks (${took}):`); for (const f of findings) console.log('  ' + f); process.exit(1) }
console.log(`\nAll ${checked} page checks fit ${WIDTH} px, no text below 13 px (${took}).`)

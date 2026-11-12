// Phone layout check, website and app, at 390 px: every page fits the screen (nothing scrolls the
// page sideways; a wide row scrolls inside its own container) and no visible text is below 13 px.
//   npx next build && SELF_BASE=http://localhost:3123 npx next start -p 3123   (separate terminal)
//   node scripts/check-phone-layout.mjs [base]          (default http://localhost:3123)
// Exits 1 and names the cause on any finding.
// Runs each page with and without reduced motion (the peak page's overflow showed only with it),
// every fold open, in German (long words). Only fixed places: Wien, Großglockner and one of its routes,
// airport LOWW.
// Layout only, no weather: the pages' /api/ answers and the search box's place suggestions come from
// scripts/layout-fixtures.json, so a run asks no weather source. A request recorded with other values
// (a date, a time) gets its route's recorded answer; one with no recorded answer at all is a finding.
// When a page asks for something new or an answer changes shape, record them again:
//   RECORD=1 node scripts/check-phone-layout.mjs https://metablend.app     (then commit the file)
// Two live requests first, the city page's forecast for Vienna and the summit page's for Großglockner,
// so a broken production API still turns the check red; they are the answers those two pages fetch
// when they render on the server, so after a deploy they cost nothing extra. The city, summit and airport
// pages render on the server on their first visit after a deploy and fetch their own data there.
// The check is no visitor: it sends its own user agent (…MetaBlendLayoutCheck/1) and blocks the
// analytics (Plausible, Vercel Web Analytics and Speed Insights), and fails if any of them got through,
// if any load on another host than metablend.app, or if none load on metablend.app.
// In CI (.github/workflows/phone-layout.yml) it runs against metablend.app after every production
// deploy of a push to main, with EDGE=/usr/bin/google-chrome.
// The app pages and the website pages each run in a fresh browser context, and the browser picks its own
// debugging port, so neither another view nor another run on the same machine can leak into a page.
// A call to the browser has 45 s, a page 2 minutes and the run 20 minutes: a hang fails fast and names the page.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import featured from '../lib/hike/featured.json' with { type: 'json' }
import { hikeApiPath } from '../lib/hike/params.js'
import { ANALYTICS, IS_ANALYTICS, analyticsLeak } from './lib/analytics-block.mjs'
import { TERMS_CAPTURE_SCRIPT } from '../lib/terms.js'
import { shapeDiff } from './lib/shape.mjs'
import { launchBrowser } from './lib/browser.mjs'

const BASE = process.argv[2] ?? 'http://localhost:3123'
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'layout-fixtures.json')
const RECORD = !!process.env.RECORD
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const WIDTH = 390
// [name, path, how]: 'search' opens the forecast by searching Wien; 'week' then opens the Week tab;
// 'notice' is the terms notice (lib/terms.js): the app's first-start screen, the website's one-time bar
const PAGES = [
  ['forecast', '/', 'search'], ['forecast week', '/', 'week'],
  ['hiking', '/hike'], ['peak', '/hike?peak=grossglockner'], ['route', '/hike?peak=grossglockner&route=osm-14622955'],
  ['more', '/more'], ['rankings', '/leaderboard'], ['planner', '/planner'], ['heatmap', '/heatmap'],
  ['aviation', '/aviation'], ['airport', '/aviation/LOWW'], ['summit page', '/mountains/grossglockner'],
  ['city page', '/weather/vienna'], ['privacy', '/privacy'], ['terms', '/terms'], ['impressum', '/impressum'], ['support', '/support'],
  ['terms notice', '/?terms=show', 'notice'],
]
// [name, path, how, link, part, only this view]: a link to a part of a page has to land on that part
// (2026-11-10: the footer's link to the terms' copyright section ended at the top of the terms). Without
// a link the address itself is opened: the link to the WeatherAPI notice only shows while WeatherAPI
// answers (app/components/outlook/SourcesPanel.jsx), which a recording cannot promise.
const PART_LINKS = [
  ['copyright link in the footer', '/privacy', undefined, 'footer a[href="/terms#copyright"]', 'copyright', 'website'],
  ['disclaimer link', '/aviation', undefined, 'a[href="/terms#disclaimer"]', 'disclaimer'],
  ['WeatherAPI notice by its address', '/terms#weatherapi-notice', undefined, null, 'weatherapi-notice'],
]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const visible = sel => `[...document.querySelectorAll(${JSON.stringify(sel)})].some(e => e.getClientRects().length > 0)`
const analytics = { blocked: 0, sent: 0 }
const findings = []

// The recorded answers, keyed by method, path with query, and a hash of a POST body; the search box asks
// Open-Meteo's place search from the browser, so its answers are recorded too.
const PLACES = 'https://geocoding-api.open-meteo.com/' // app/HomePage.jsx
const recorded = RECORD ? { recorded: new Date().toISOString(), from: BASE, answers: {} } : JSON.parse(readFileSync(FIXTURES, 'utf8'))

// The live smoke requests: [what, path, the answer is usable, shape options]. A thin blend is no failure, a broken API is.
// Each is recorded too, and a live answer whose shape (keys and types) differs from its recording means the
// recording no longer matches what the pages get: re-record.
const SMOKE = [
  ['city forecast', '/api/forecast?city=vienna&lang=en', j => j.sources?.length > 0 && typeof j.consensus?.temp === 'number',
    { maps: ['.weights', '.recentScores'], optional: ['.cached'] }], // app/weather/[city]/page.js; weights and scores per source; cached: from the route's own cache
  ['summit forecast', hikeApiPath(featured.find(p => p.id === 'grossglockner')), j => j.hourly?.length > 0 && j.days?.length > 0, {}], // app/mountains/[peak]/page.js
]
const RERECORD = 're-record fixtures (RECORD=1, see the top of this file)'
for (const [what, path, usable, shape] of SMOKE) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(60_000) }).catch(e => ({ ok: false, status: `nothing (${e.cause?.code ?? e.name})` }))
  const j = r.ok ? await r.json().catch(() => null) : null
  const ok = j && usable(j)
  if (RECORD) { if (ok) recorded.answers[`GET ${path}`] = { status: 200, type: 'application/json', body: j }; else findings.push(`live ${what} (${path}): not recorded, it ${r.ok ? 'answered without its data' : `answered ${r.status}`}`); continue }
  if (!ok) findings.push(`live ${what} (${path}): ${r.ok ? 'answered without its data' : `answered ${r.status}`}`)
  const was = recorded.answers[`GET ${path}`]?.body
  const diff = ok ? (was ? shapeDiff(was, j, shape) : ['it has no recording']) : []
  if (diff.length) findings.push(`live ${what}: its shape differs from the recording (${diff.slice(0, 4).join('; ')}${diff.length > 4 ? `; ${diff.length - 4} more` : ''}): ${RERECORD}`)
  console.log(`${ok && !diff.length ? '✓' : '✗'} live ${what}`)
}

const routeOf = (method, u) => `${method} ${u.hostname === new URL(BASE).hostname ? '' : u.hostname}${u.pathname}`
const keyOf = ({ method, url, postData }) => { const u = new URL(url); return `${routeOf(method, u)}${u.search}${postData ? ' ' + createHash('sha1').update(postData).digest('hex').slice(0, 12) : ''}` }
const byRoute = new Map()
for (const [key, a] of Object.entries(recorded.answers)) { const route = key.split(/[? ]/, 2).join(' '); if (!byRoute.has(route)) byRoute.set(route, a) }
const served = { exact: 0, route: 0, missing: new Set() }
// requests the browser sends to other hosts (map tiles, the radar): counted, not answered
const outside = new Map()
// The browser (scripts/lib/browser.mjs, as for the accessibility check and the store screenshots): a free
// debugging port of its own, read back from DevToolsActivePort in its profile, so two runs at once never drive
// each other's browser (two sessions shared the fixed port 9441 on 2026-11-10; one run stalled, one saw a
// website page "opened as the app"). Its profile (about 400 MB) goes however the run ends, also after an error.
// Up to 30 s for the port: on a busy CI runner the browser took longer than the 10 s waited before (run 29).
const launched = await launchBrowser(EDGE, 'layout-', [...(process.env.CI ? ['--no-sandbox'] : []), '--hide-scrollbars']).catch(() => null)
if (!launched) { console.error('The browser did not open its debugging port within 30 seconds: no page was checked.'); process.exit(1) }
const { active, close: closeBrowser } = launched
console.log(`browser on debugging port ${new URL(active).port}`)

// Time limits, so a stuck browser fails fast and names the page instead of running on: every browser
// call 45 s, a page 2 minutes (which stops the run), the whole run 20 minutes: a full run takes 6 to 6.5 minutes
// on CI (346 to 380 s, 27 runs to 2026-11-10) and about 5 on a PC (315 s, also with a second run at once).
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
// the page connection of the view being checked
let send = null
// a paused request: answered from the recording (RECORD=1: asked once from where it was going, and kept)
async function answer({ requestId, request }) {
  const key = keyOf(request), u = new URL(request.url)
  if (RECORD && !recorded.answers[key]) {
    const r = await fetch(request.url, { method: request.method, headers: { 'content-type': 'application/json' }, body: request.postData })
    const type = r.headers.get('content-type') ?? 'application/json', text = await r.text()
    recorded.answers[key] = { status: r.status, type, body: type.includes('json') ? JSON.parse(text) : text }
  }
  const a = recorded.answers[key] ?? byRoute.get(routeOf(request.method, u))
  if (!a) { served.missing.add(routeOf(request.method, u)); return send('Fetch.failRequest', { requestId, errorReason: 'Failed' }) }
  served[a === recorded.answers[key] ? 'exact' : 'route']++
  const body = Buffer.from(typeof a.body === 'string' ? a.body : JSON.stringify(a.body)).toString('base64')
  return send('Fetch.fulfillRequest', { requestId, responseCode: a.status, responseHeaders: [{ name: 'Content-Type', value: a.type }, { name: 'Access-Control-Allow-Origin', value: '*' }], body })
}
const onEvent = m => {
  if (m.method === 'Fetch.requestPaused') answer(m.params).catch(() => send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'Failed' }).catch(() => {}))
  if (m.method === 'Network.loadingFailed' && m.params.blockedReason === 'inspector') analytics.blocked++
  if (m.method === 'Network.responseReceived' && IS_ANALYTICS.test(m.params.response.url)) analytics.sent++
  if (m.method === 'Network.requestWillBeSent') {
    const url = m.params.request.url, host = URL.canParse(url) ? new URL(url).hostname : ''
    if (host && host !== new URL(BASE).hostname && !url.startsWith(PLACES) && !IS_ANALYTICS.test(url)) outside.set(host, (outside.get(host) ?? 0) + 1)
  }
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
  // the terms notice counts as passed, so the pages show; a URL with terms=show gets the notice (lib/terms.js)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: TERMS_CAPTURE_SCRIPT })
  const { userAgent } = (await browser.call('Browser.getVersion')).result
  await send('Network.setUserAgentOverride', { userAgent: `${userAgent} MetaBlendLayoutCheck/1` })
  await send('Network.setBlockedURLs', { urls: ANALYTICS })
  await send('Fetch.enable', { patterns: [{ urlPattern: `${BASE}/api/*` }, { urlPattern: `${PLACES}*` }] })
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
async function checkPage(view, motion, name, path, how, link, part) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: motion }] })
  await send('Network.clearBrowserCookies')
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' })
  await send('Network.setCookie', { name: 'metablend_lang', value: 'de', url: BASE + '/' })
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200)
  // the app's forecast is its first tab; it opens from another page, like the app itself
  const start = view === 'app' && how && how !== 'notice' ? '/more' : path
  // a page that never answers stops the run with its name (send throws after 45 s); an error page is a finding
  const [page, hash] = start.split('#') // the app's marker goes before a part's name
  const nav = await send('Page.navigate', { url: BASE + page + (view === 'app' ? (page.includes('?') ? '&' : '?') + 'app=1' : '') + (hash ? '#' + hash : '') })
  if (nav.error || nav.result?.errorText) throw new Error(`did not load: ${nav.error?.message ?? nav.result.errorText}`)
  const noticeUp = visible(view === 'app' ? '.terms-notice button' : '.terms-bar button')
  await until(how === 'notice' ? noticeUp : view === 'app' ? visible('.app-tabbar a') : 'document.readyState === "complete"')
  if (how === 'notice' && !(await ev(noticeUp))) { findings.push(`${view} ${name}: the notice did not come up`); console.log(`✗ ${view} ${name}`); return }
  // the imprint has to be reachable at all times: the app's notice links to it, since the More tab is out of reach behind it
  if (how === 'notice' && view === 'app' && !(await ev(visible('.terms-notice a[href="/impressum"]')))) findings.push(`${view} ${name}: no link to the imprint`)
  if (how && how !== 'notice') {
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
  if (!part) return
  // the link is clicked like a visitor's tap (a client-side navigation), then the part has to stand in the
  // upper half of the screen, or anywhere on it when the page cannot scroll further
  const clicked = !link || await ev(`(() => { const a = [...document.querySelectorAll(${JSON.stringify(link)})].find(e => e.getClientRects().length > 0); if (a) a.click(); return !!a })()`)
  const opened = clicked && await until(`location.hash === ${JSON.stringify('#' + part)} && !!document.getElementById(${JSON.stringify(part)})`, 15000)
  await sleep(1500)
  const at = opened ? await ev(`(() => { const top = Math.round(document.getElementById(${JSON.stringify(part)}).getBoundingClientRect().top), end = innerHeight + scrollY >= document.documentElement.scrollHeight - 4; return { top, lands: top >= -4 && top <= (end ? innerHeight - 40 : innerHeight / 2) } })()`) : null
  if (!at?.lands) findings.push(`${label}: ${!clicked ? `no link ${link} on the page` : !opened ? `the link did not open #${part}` : `the link ended ${at.top} px away from #${part}, not on it`}`)
  console.log(`${at?.lands ? '✓' : '✗'} ${label}: lands on #${part}`)
}

let checked = 0
const started = Date.now()
try {
  views: for (const view of ['app', 'website']) {
    const close = await openView()
    try {
      for (const motion of ['reduce', 'no-preference']) for (const [name, path, how, link, part, only] of [...PAGES, ...(motion === 'reduce' ? [] : PART_LINKS)]) {
        if (only && only !== view) continue
        current = `${view} ${name}${motion === 'reduce' ? ' (reduced motion)' : ''}`
        let timer
        const outcome = await Promise.race([
          checkPage(view, motion, name, path, how, link, part).then(() => 'done', e => `failed: ${e.message}`),
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
if (RECORD) {
  // one answer per line, sorted, so a new recording shows in a diff as the answers that changed
  const lines = Object.entries(recorded.answers).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  writeFileSync(FIXTURES, `{\n"recorded": ${JSON.stringify(recorded.recorded)},\n"from": ${JSON.stringify(recorded.from)},\n"answers": {\n${lines.join(',\n')}\n}}\n`)
  console.log(`recorded ${lines.length} answers from ${BASE} into scripts/layout-fixtures.json`)
} else console.log(`data: ${served.exact} answers from the recording of ${recorded.recorded.slice(0, 10)}, ${served.route} by their route's answer, ${SMOKE.length} live`)
if (served.missing.size) findings.push(`no recorded answer for ${[...served.missing].join(', ')}: ${RERECORD}`)
console.log(`other hosts (not answered here): ${[...outside].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h} ${n}`).join(', ') || 'none'}`)
console.log(`analytics: ${analytics.blocked} requests blocked, ${analytics.sent} reached their service`)
const leak = analyticsLeak(analytics), onSite = new URL(BASE).hostname === 'metablend.app', tried = analytics.blocked + analytics.sent
if (leak) findings.push(leak)
if (!onSite && tried) findings.push(`analytics: ${tried} requests on ${new URL(BASE).host}; they load only on metablend.app (app/components/SiteAnalytics.jsx)`)
if (onSite && !tried) findings.push('analytics: none loaded on metablend.app, so the site counts no visits (app/components/SiteAnalytics.jsx)')
if (findings.length) { console.log(`\n${findings.length} finding(s) in ${checked} page checks (${took}):`); for (const f of findings) console.log('  ' + f); process.exit(1) }
console.log(`\nAll ${checked} page checks fit ${WIDTH} px, no text below 13 px (${took}).`)

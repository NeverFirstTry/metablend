// UX walk over a LOCAL build, never production: one configuration per run (view, width, theme, language).
// For each screen it saves viewport slices and the measures of audit.js (sizes of controls, names from the
// browser's accessibility tree, contrast, text sizes, cut-off text, colours, wording); laws.js adds response
// times after a tap, choices on a first screen and what is gold. The page's own API requests are recorded once
// and replayed (api-cache.json), so the weather sources are asked once per address and every configuration
// shows the same data. Parts that exist only inside the phone app show in the native-* configurations through
// native-standin.js: no system dialog and no real notification is seen there.
//
// Before a run: `npx next build`, then `SELF_BASE=http://localhost:3211 npx next start -p 3211`, then ask the
// start page once and wait for its rebuild (its example forecast is fetched while the page is built; a build
// made while no server answered has none, and the first-visit screens would be wrong).
//   node scripts/ux/walk.mjs <config>            every screen of one configuration
//   ONLY=faults node scripts/ux/walk.mjs app-dark-en     the measures against a page of planted faults
//   ONLY=laws-speed,laws-gold node scripts/ux/walk.mjs app-dark-en
// env: ONLY=id,id  BASE=http://localhost:3211  SCALE=2  WIDTH=320  TEXT=1.5  TAG=name  LATENCY=600
//      OUT=<folder> (default: the system's temp folder, metablend-ux-walk)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { launchBrowser } from '../lib/browser.mjs'
import { ANALYTICS } from '../lib/analytics-block.mjs'
import { TERMS_CAPTURE_SCRIPT } from '../../lib/terms.js'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.OUT ?? join(tmpdir(), 'metablend-ux-walk')
const AUDIT_SRC = readFileSync(join(HERE, 'audit.js'), 'utf8')
const NATIVE_SRC = readFileSync(join(HERE, 'native-standin.js'), 'utf8')
const LAWS_SRC = readFileSync(join(HERE, 'laws.js'), 'utf8')

const CONFIGS = {
  'app-dark-en': { app: true, phone: true, theme: 'dark', lang: 'en' },
  'app-light-en': { app: true, phone: true, theme: 'light', lang: 'en' },
  'app-dark-de': { app: true, phone: true, theme: 'dark', lang: 'de' },
  'app-dark-ja': { app: true, phone: true, theme: 'dark', lang: 'ja' },
  'native-dark-en': { app: true, phone: true, theme: 'dark', lang: 'en', native: true },
  'native-light-de': { app: true, phone: true, theme: 'light', lang: 'de', native: true },
  'web-dark-en': { app: false, phone: false, theme: 'dark', lang: 'en' },
  'web-light-en': { app: false, phone: false, theme: 'light', lang: 'en' },
  'web-dark-de': { app: false, phone: false, theme: 'dark', lang: 'de' },
  'web-light-ja': { app: false, phone: false, theme: 'light', lang: 'ja' },
  'webphone-dark-en': { app: false, phone: true, theme: 'dark', lang: 'en' },
  'webphone-light-de': { app: false, phone: true, theme: 'light', lang: 'de' },
}
const [NAME] = process.argv.slice(2)
const C = CONFIGS[NAME]
if (!C) { console.log(`config? one of: ${Object.keys(CONFIGS).join(', ')}`); process.exit(2) }
const BASE = process.env.BASE ?? 'http://localhost:3211'
const WIDTH = Number(process.env.WIDTH ?? 390), TEXT = process.env.TEXT
const OUT = join(ROOT, NAME + (process.env.WIDTH ? `-w${WIDTH}` : '') + (TEXT ? `-text${TEXT}` : '') + (process.env.TAG ? `-${process.env.TAG}` : ''))
mkdirSync(OUT, { recursive: true })
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const CITY = C.lang === 'de' ? 'Wien' : 'Vienna'
const b64 = s => Buffer.from(s).toString('base64')

// --- browser
const { targets, close } = await launchBrowser(EDGE, 'uxwalk-', ['--hide-scrollbars'])
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0; const pending = new Map(), handlers = {}
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } else if (m.method && handlers[m.method]) handlers[m.method](m.params) })
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description?.slice(0, 300) ?? 'page error'); return r.result?.result?.value }
const until = async (expr, ms = 45000) => { for (let s = 0; s < ms; s += 250) { if (await ev(expr).catch(() => false)) return true; await sleep(250) } return false }
for (const d of ['Page', 'Runtime', 'Network', 'Log', 'DOM', 'Accessibility']) await send(`${d}.enable`)
await send('Network.setBlockedURLs', { urls: ANALYTICS })
await send('Page.addScriptToEvaluateOnNewDocument', { source: TERMS_CAPTURE_SCRIPT })
if (TEXT) await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__textScale = ${Number(TEXT)}` })
if (C.native) await send('Page.addScriptToEvaluateOnNewDocument', { source: NATIVE_SRC })
const ua = (await send('Browser.getVersion')).result.userAgent.replace('HeadlessChrome', 'Chrome')
await send('Network.setUserAgentOverride', { userAgent: `${ua} MetaBlendUxReview/1${C.app ? ' MetaBlendApp' : ''}` })
const VIEW = C.phone ? { width: WIDTH, height: 844, mobile: true } : { width: 1280, height: 900, mobile: false }
const SCALE = Number(process.env.SCALE ?? (C.phone ? 1 : 0.75))
await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: SCALE })
if (C.phone) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: C.theme }] })

// --- problems the page itself reports
let problems = []
handlers['Runtime.exceptionThrown'] = p => problems.push(`exception: ${(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).slice(0, 200)}`)
handlers['Log.entryAdded'] = p => { if (p.entry.level === 'error' && !/favicon|ERR_BLOCKED_BY_CLIENT|ERR_FAILED/.test(p.entry.text + (p.entry.url ?? ''))) problems.push(`console: ${p.entry.text.slice(0, 160)} ${(p.entry.url ?? '').slice(0, 80)}`) }
handlers['Network.responseReceived'] = p => { if (p.response.status >= 400 && p.response.url.startsWith(BASE)) problems.push(`${p.response.status} ${p.response.url.slice(BASE.length, BASE.length + 90)}`) }

// --- API answers: recorded once, replayed; a screen can make them fail or slow
const CACHE_FILE = join(ROOT, 'api-cache.json')
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
const mode = {}
let asked = 0, replayed = 0
await send('Fetch.enable', { patterns: [{ urlPattern: `${BASE}/api/*`, requestStage: 'Request' }, { urlPattern: `${BASE}/api/*`, requestStage: 'Response' }] })
handlers['Fetch.requestPaused'] = async p => {
  const { requestId, request } = p, path = request.url.slice(BASE.length)
  const key = `${request.method} ${path}${request.postData ? ' ' + request.postData.slice(0, 600) : ''}`
  const keep = (request.method === 'GET' && !/^\/api\/(push|health|feedback|testers)/.test(path)) || /^\/api\/(route-weather|route-heights)/.test(path)
  try {
    if (p.responseStatusCode === undefined && !p.responseErrorReason) {
      if (mode.fail?.test(path)) return await send('Fetch.fulfillRequest', { requestId, responseCode: mode.code ?? 500, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: b64(mode.body ?? '{"error":"stand-in failure"}') })
      if (mode.down?.test(path)) return await send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' })
      if (mode.slow) await sleep(mode.slow)
      const hit = keep && cache[key]
      if (hit) { replayed++; return await send('Fetch.fulfillRequest', { requestId, responseCode: hit.status, responseHeaders: hit.headers, body: hit.body }) }
      asked++
      return await send('Fetch.continueRequest', { requestId })
    }
    if (p.responseErrorReason || (p.responseStatusCode >= 300 && p.responseStatusCode < 400)) return await send('Fetch.continueRequest', { requestId })
    const got = (await send('Fetch.getResponseBody', { requestId })).result
    if (!got) return await send('Fetch.continueRequest', { requestId })
    const body = got.base64Encoded ? got.body : b64(got.body)
    const headers = p.responseHeaders.filter(h => !/^(content-encoding|content-length|transfer-encoding)$/i.test(h.name))
    if (keep && p.responseStatusCode === 200 && !Buffer.from(body, 'base64').subarray(0, 4000).toString().includes('"unavailable":true')) cache[key] = { status: 200, headers: headers.filter(h => /^content-type$/i.test(h.name)), body }
    return await send('Fetch.fulfillRequest', { requestId, responseCode: p.responseStatusCode, responseHeaders: headers, body })
  } catch { /* the page went on */ }
}

// --- one screen
const summary = []
let current = null
const snap = async file => writeFileSync(join(OUT, file), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'))
const h = {
  ev, until, sleep, mode, CITY, C,
  // viewport slices from the top
  async shot(name = '', max = C.phone ? 4 : 3) {
    const tall = await ev('document.documentElement.scrollHeight'), step = VIEW.height - (C.app ? 110 : 60)
    const last = Math.max(0, tall - VIEW.height)
    let i = 0
    for (let y = 0; i < max; y += step, i++) {
      const at = Math.min(y, last)
      await ev(`window.scrollTo({ top: ${at}, behavior: 'instant' })`); await sleep(350)
      await snap(`${current.id}${name ? '-' + name : ''}-${i + 1}.png`)
      if (at >= last) { i++; break }
    }
    await ev(`window.scrollTo({ top: 0, behavior: 'instant' })`)
    return i
  },
  // the viewport with one element in its middle
  async shotAt(name, expr) {
    const ok = await ev(`(() => { const el = ${expr}; if (!el) return false; el.scrollIntoView({ block: 'center', behavior: 'instant' }); return true })()`)
    if (!ok) { problems.push(`shotAt ${name}: element not found`); return }
    await sleep(450); await snap(`${current.id}-${name}.png`)
  },
  async audit(name = '') {
    const a = await ev(`${AUDIT_SRC}\nAUDIT(${JSON.stringify({ phone: C.phone, dark: C.theme === 'dark' })})`)
    // what a screen reader is given: controls without a name, and names that are no words
    const tree = (await send('Accessibility.getFullAXTree')).result?.nodes ?? []
    const roles = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'switch', 'radio', 'tab', 'slider', 'menuitem', 'listbox', 'img', 'image', 'spinbutton'])
    a.unnamed = []; a.oddNames = []
    for (const n of tree) {
      if (n.ignored || !roles.has(n.role?.value)) continue
      const nm = (n.name?.value ?? '').trim()
      if (nm && /\p{L}{2,}|\d/u.test(nm)) continue
      const node = n.backendDOMNodeId && (await send('DOM.resolveNode', { backendNodeId: n.backendDOMNodeId })).result?.object
      const html = node?.objectId ? (await send('Runtime.callFunctionOn', { objectId: node.objectId, functionDeclaration: 'function(){ return this.checkVisibility && !this.checkVisibility() ? null : (this.outerHTML || "").replace(/\\s+/g, " ").slice(0, 170) }', returnByValue: true })).result?.result?.value : '(no node)'
      if (html === null) continue;
      (nm ? a.oddNames : a.unnamed).push({ role: n.role.value, name: nm, html })
    }
    a.problems = [...new Set(problems)]
    writeFileSync(join(OUT, `${current.id}${name ? '-' + name : ''}.json`), JSON.stringify(a, null, 1))
    summary.push({ screen: `${current.id}${name ? '-' + name : ''}`, tap: a.tap.length, tiny: a.tap.filter(t => t.min < 24).length, contrast: a.contrast.length, small: a.small.map(s => `${s.px}px x${s.n}`).join(' '), cut: a.cut.length, unnamed: a.unnamed.length, odd: a.oddNames.length, icons: a.icons.length, wide: a.docW > a.w ? a.docW : 0, safe: a.safe.length, problems: a.problems.length })
    return a
  },
  click: expr => ev(`(() => { const el = ${expr}; if (!el) return false; el.click(); return true })()`),
  async type(expr, text) {
    await ev(`(() => { const el = ${expr}; el.focus(); el.select?.() })()`)
    await send('Input.insertText', { text }); await sleep(120)
  },
  async key(key, code = key, vk = 13) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }) },
  async files(expr, paths) {
    const obj = (await send('Runtime.evaluate', { expression: expr })).result?.result
    if (!obj?.objectId) return false
    await send('DOM.setFileInputFiles', { files: paths, objectId: obj.objectId }); return true
  },
  note: (k, v) => { summary.push({ screen: `${current.id} NOTE ${k}`, value: v }) },
  laws: expr => ev(`(() => { ${LAWS_SRC}\nreturn ${expr} })()`),
  async slowPhone() { await send('Emulation.setCPUThrottlingRate', { rate: 4 }); await send('Network.emulateNetworkConditions', { offline: false, latency: Number(process.env.LATENCY ?? 150), downloadThroughput: (process.env.LATENCY ? 0.4 : 1.6) * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 }); mode.slow = Number(process.env.LATENCY ?? 150) * 2 + 100 },
  send,
}

async function open(s) {
  current = s; problems = []
  for (const k of Object.keys(mode)) delete mode[k]
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await send('Network.setBlockedURLs', { urls: s.noPrefetch ? [...ANALYTICS, '*_rsc=*'] : ANALYTICS })
  await send('Page.navigate', { url: 'about:blank' }); await sleep(120)
  await send('Network.clearBrowserCookies')
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'local_storage,session_storage,indexeddb,cache_storage,service_workers' })
  const cookies = { metablend_lang: C.lang, metablend_theme: C.theme, ...(s.cookies ?? {}) }
  for (const [name, value] of Object.entries(cookies)) await send('Network.setCookie', { name, value, url: BASE })
  let seed = null
  if (s.storage) seed = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{${Object.entries(s.storage).map(([k, v]) => `if(localStorage.getItem(${JSON.stringify(k)})===null)localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(typeof v === 'string' ? v : JSON.stringify(v))})`).join(';')}}catch(e){}` })).result.identifier
  if (s.before) await s.before(h)
  await send('Page.navigate', { url: s.path.startsWith('file:') ? s.path : BASE + s.path })
  if (!s.raw) {
    await until(`document.readyState === 'complete'`, 30000)
    if (s.ready && !(await until(s.ready, s.wait ?? 45000))) problems.push(`not ready: ${s.ready.slice(0, 80)}`)
    await sleep(s.settle ?? 900)
  }
  try { await (s.steps ?? (async x => { await x.shot('', s.slices); await x.audit() }))(h) } catch (e) { problems.push(`steps: ${e.message.slice(0, 200)}`); summary.push({ screen: `${s.id} FAILED`, value: e.message.slice(0, 200) }) }
  if (seed) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seed })
  console.log(`${NAME} ${s.id}: ${[...new Set(problems)].slice(0, 3).join(' | ') || 'ok'}`)
}

// --- the screens
const FORECAST = `!!document.querySelector('.text-7xl') && document.querySelectorAll('[role=tab]').length >= 3`
const allSources = x => x.until(`(() => { const b = document.querySelector('.home-more button[aria-expanded]'); const n = b && +(b.innerText.match(/\\d+/) ?? [0])[0]; return n >= 15 })()`, 25000)
const tab = i => `document.querySelectorAll('.home-forecast [role=tab], [role=tablist] [role=tab]')[${i}]`
const GPX = join(HERE, 'sample.gpx'), BAD = join(HERE, 'broken.gpx')
const PEAK = '/hike?peak=grossglockner', ROUTE = '/hike?peak=grossglockner&route=osm-14622955'
const SCREENS = [
  { id: 'first', path: '/?terms=show', steps: async x => {
    await x.shot('notice', 1); await x.audit('notice')
    if (await x.click(`document.querySelector('.terms-notice button, .terms-bar button')`)) { await x.sleep(900); await x.shot('after', C.app ? 2 : 4); await x.audit('after') }
  } },
  { id: 'home', path: `/?city=${CITY}`, ready: FORECAST, steps: async x => {
    await allSources(x)
    await x.shot('', C.phone ? 6 : 5); await x.audit()
    for (const [i, name] of [[1, 'tomorrow'], [2, 'week']]) { await x.click(tab(i)); await x.sleep(900); await x.shot(name, C.phone ? 4 : 3); await x.audit(name) }
  } },
  { id: 'folds', path: `/?city=${CITY}`, ready: FORECAST, steps: async x => {
    await allSources(x)
    const names = await x.ev(`[...document.querySelectorAll('button[aria-expanded]')].map(b => b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40) + ' [' + b.getAttribute('aria-expanded') + ']' + (b.closest('.web-only') ? ' web' : ''))`)
    x.note('folds', names)
    const n = await x.ev(`document.querySelectorAll('button[aria-expanded]').length`)
    for (let i = 0; i < n; i++) {
      const shown = await x.ev(`(() => { const b = document.querySelectorAll('button[aria-expanded]')[${i}]; if (!b || !b.checkVisibility()) return false; if (b.getAttribute('aria-expanded') === 'false') b.click(); return true })()`)
      if (!shown) continue
      await x.sleep(i === 0 ? 1500 : 900)
      await x.ev(`(() => { const b = document.querySelectorAll('button[aria-expanded]')[${i}]; b.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy({ top: -90, behavior: 'instant' }) })()`)
      await x.sleep(1200); await snap(`folds-${i + 1}.png`)
    }
    await x.audit()
  } },
  { id: 'search', path: '/', ready: `!!document.querySelector('.home-search input')`, steps: async x => {
    await x.shot('empty', 2); await x.audit('empty')
    await x.type(`document.querySelector('.home-search input')`, 'Vie'); await x.until(`!!document.querySelector('#home-suggest [role=option], #home-suggest li')`, 8000); await x.sleep(500)
    await x.shot('suggest', 1); await x.audit('suggest')
    await x.type(`document.querySelector('.home-search input')`, 'qqqxzyw'); await x.sleep(1500); await x.shot('nomatch', 1)
    await x.key('Enter'); await x.sleep(4000); await x.shot('notfound', 1); await x.audit('notfound')
  } },
  { id: 'recents', path: '/', cookies: { metablend_recent: encodeURIComponent(JSON.stringify(['Buôn Ma Thuột', 'Buon Ma Thuot', 'Sankt Leonhard am Hornerwald', CITY, 'Zürich'])) }, storage: { mb_favorites: ['Innsbruck', 'Garmisch-Partenkirchen', 'Ljubljana'] }, ready: `!!document.querySelector('.home-search input')`, steps: async x => { await x.sleep(600); await x.shot('', 2); await x.audit() } },
  { id: 'actions', path: `/?city=${CITY}`, ready: FORECAST, steps: async x => {
    await x.shotAt('toolbar', `document.querySelector('.home-search')`)
    x.note('search-row', await x.ev(`[...document.querySelectorAll('.home-search button')].map(b => (b.getAttribute('aria-label') ?? '') + ' | text:' + b.innerText.trim() + ' | ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height))`))
    x.note('toolbar', await x.ev(`[...document.querySelectorAll('button[aria-expanded], button[title]')].filter(b => b.checkVisibility() && !b.closest('.home-search')).slice(0, 12).map(b => (b.getAttribute('aria-label') ?? b.title ?? '') + ' | text:' + b.innerText.trim().slice(0, 20) + ' | ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height))`))
    if (await x.click(`document.querySelector('button:has(svg.lucide-code-xml), button:has(svg.lucide-code-2), button:has(svg.lucide-code)')`)) { await x.sleep(900); await x.shotAt('embed', `document.querySelector('button:has(svg.lucide-code-xml), button:has(svg.lucide-code-2), button:has(svg.lucide-code)')`); await x.audit('embed') } else x.note('embed', 'button not found')
    if (await x.click(`document.querySelector('.home-search button[aria-pressed]')`)) { await x.sleep(700); await x.shotAt('compare', `document.querySelector('.home-search')`); await x.audit('compare') } else x.note('compare', 'button not found')
  } },
  { id: 'error', path: `/?city=${CITY}`, before: async x => { x.mode.fail = /^\/api\/(outlook|forecast)/ }, settle: 4000, steps: async x => { await x.shot('500', 2); await x.audit('500'); x.note('error box', await x.ev(`[...document.querySelectorAll('[role=alert],[aria-live]')].map(e => (e.getAttribute('role') ?? '') + '/' + (e.getAttribute('aria-live') ?? '') + ': ' + e.innerText.trim().slice(0, 50))`)) } },
  { id: 'down', path: `/?city=${CITY}`, before: async x => { x.mode.down = /^\/api\// }, settle: 4000, steps: async x => { await x.shot('', 2) } },
  { id: 'loading', path: `/?city=${CITY}`, raw: true, before: async x => { x.mode.slow = 6000 }, steps: async x => { await x.sleep(1500); await snap('loading-1.png'); await x.sleep(2500); await snap('loading-2.png'); await x.audit(); x.note('loading told', await x.ev(`[...document.querySelectorAll('[role=status],[role=alert],[aria-live],[aria-busy]')].map(e => (e.getAttribute('role') ?? '') + '/' + (e.getAttribute('aria-live') ?? '') + '/' + (e.getAttribute('aria-busy') ?? '') + ': ' + e.innerText.trim().slice(0, 40))`)) } },
  { id: 'offline', path: `/?city=${CITY}`, ready: FORECAST, steps: async x => {
    await x.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
    await x.ev(`window.dispatchEvent(new Event('offline'))`); await x.sleep(1200); await x.shot('', 1); await x.audit()
  } },
  { id: 'prompt', native: true, path: `/?city=${CITY}`, storage: { cap_mb_city_views: JSON.stringify({ [CITY]: 4 }) }, ready: FORECAST, settle: 3000, steps: async x => { await x.shotAt('card', `document.querySelector('button[aria-label="×"]')?.parentElement`); await x.audit(); x.note('prompt text', await x.ev(`document.querySelector('button[aria-label="×"]')?.parentElement?.innerText?.replace(/\s+/g, ' ')`)); x.note('prompt', await x.ev(`[...document.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label')).join(' | ').slice(0, 300)`)) } },
  { id: 'cities', path: '/weather', noPrefetch: true, slices: 2 },
  { id: 'city', path: '/weather/vienna', slices: 4 },
  { id: 'hike', path: '/hike', noPrefetch: true, settle: 2500, steps: async x => {
    await x.shot('', 4); await x.audit()
    const input = `document.querySelector('main input[type=search], main input[role=combobox], main input[type=text]')`
    if (C.app && await x.ev(`!!${input}`)) {
      await x.type(input, 'Glock'); await x.sleep(2500); await x.shot('search', 1)
      await x.type(input, 'qqqxzyw'); await x.sleep(2500); await x.shot('nomatch', 1); await x.audit('nomatch')
    }
  } },
  { id: 'peak', app: true, path: PEAK, ready: `document.querySelectorAll('main svg').length > 3 && !!document.querySelector('[role=tab]')`, settle: 2500, steps: async x => {
    await x.shot('', 6); await x.audit()
    const n = await x.ev(`document.querySelectorAll('[role=tab]').length`)
    for (let i = 1; i < Math.min(n, 4); i++) { await x.click(`document.querySelectorAll('[role=tab]')[${i}]`); await x.sleep(900); await x.shot(`tab${i + 1}`, 2) }
    const plan = `[...document.querySelectorAll('button[aria-expanded]')].find(b => b.closest('main') && /plan|plane/i.test(b.innerText))`
    if (await x.click(plan)) {
      await x.sleep(900); await x.shotAt('plan', plan); await x.audit('plan')
      const day = `(() => { const all = [...document.querySelectorAll('main button')]; const i = all.indexOf(${plan}); return i >= 0 ? all[i + 1] : null })()`
      if (await x.click(day)) { await x.sleep(2500); await x.shotAt('plan2', plan); await x.audit('plan2'); x.note('after picking a day', await x.ev(`(${plan})?.parentElement?.parentElement?.innerText?.replace(/\s+/g, ' ').slice(0, 400)`)) }
    }
  } },
  { id: 'route', app: true, path: ROUTE, ready: `!!document.querySelector('.leaflet-container')`, settle: 3500, steps: async x => {
    await x.shot('', 6); await x.audit()
    const plan = `[...document.querySelectorAll('button[aria-expanded]')].find(b => b.closest('main') && /plan|plane/i.test(b.innerText))`
    if (await x.click(plan)) {
      await x.sleep(900); await x.shotAt('plan', plan); await x.audit('plan')
      const day = `(() => { const all = [...document.querySelectorAll('main button')]; const i = all.indexOf(${plan}); return i >= 0 ? all[i + 1] : null })()`
      if (await x.click(day)) { await x.sleep(2500); await x.shotAt('plan2', plan); x.note('after picking a day', await x.ev(`(${plan})?.parentElement?.innerText?.replace(/\s+/g, ' ').slice(0, 400)`)) }
    }
  } },
  { id: 'gpx', app: true, path: '/hike', noPrefetch: true, settle: 2000, steps: async x => {
    if (!(await x.files(`document.querySelector('input[type=file]')`, [BAD]))) { x.note('gpx', 'no file input'); return }
    await x.sleep(2500); await x.shotAt('bad', `document.querySelector('input[type=file]').closest('section, div')`); await x.audit('bad')
    await x.files(`document.querySelector('input[type=file]')`, [GPX])
    await x.until(`location.search.includes('route=')`, 15000); await x.sleep(4000); await x.shot('route', 4); await x.audit('route')
    await x.send('Page.navigate', { url: BASE + '/hike' }); await x.sleep(4000); await x.shot('myroutes', 2); await x.audit('myroutes')
  } },
  { id: 'summits', path: '/mountains', noPrefetch: true, slices: 3 },
  { id: 'summit', path: '/mountains/grossglockner', noPrefetch: true, settle: 3000, slices: 5 },
  { id: 'summit-kept', path: '/mountains/ortler', noPrefetch: true, settle: 3000, slices: 2 },
  { id: 'more', path: '/more', settle: 2500, steps: async x => {
    await x.shot('', 5); const a = await x.audit()
    if (C.native) x.note('native calls', await x.ev(`[...new Set(window.__standinCalls ?? [])]`))
    if (C.native) {
      const on = `[...document.querySelectorAll('main button')].find(b => /notif|benachr|mitteil/i.test(b.innerText))`
      x.note('notifications before', await x.ev(`(${on})?.closest('section, div')?.parentElement?.innerText?.replace(/\s+/g, ' ').slice(0, 300)`))
      if (await x.click(on)) { await x.sleep(3500); await x.shotAt('notif-on', `[...document.querySelectorAll('main h2, main h3')].find(h => /notif|benachr|mitteil/i.test(h.innerText))`); await x.shot('on', 3); await x.audit('on'); x.note('native calls after', await x.ev(`[...new Set(window.__standinCalls ?? [])]`)) }
    }
    x.note('headings', a.headings)
  } },
  { id: 'rankings', path: '/leaderboard', settle: 4000, slices: 4 },
  { id: 'heatmap', path: '/heatmap', settle: 5000, slices: 3 },
  { id: 'planner', path: '/planner', settle: 1500, steps: async x => {
    await x.shot('empty', 2); await x.audit('empty')
    const input = `document.querySelector('main input')`
    if (await x.ev(`!!${input}`)) { await x.type(input, CITY); await x.key('Enter'); await x.sleep(1200); await snap('planner-loading.png'); await x.until(`!document.querySelector('main [role=status], main .sky-loader')`, 40000); await x.sleep(2500); await x.shot('result', 4); await x.audit('result') }
  } },
  { id: 'aviation', path: '/aviation', slices: 3 },
  { id: 'airport', path: '/aviation/LOWW', settle: 2500, slices: 4 },
  { id: 'terms', path: '/terms', slices: 3 },
  { id: 'privacy', path: '/privacy', slices: 2 },
  { id: 'impressum', path: '/impressum', slices: 2 },
  { id: 'support', path: '/support', slices: 3 },
  { id: 'testers', app: false, path: '/testers', slices: 3 },
  { id: 'notfound', path: '/gibt-es-nicht', slices: 1 },
  { id: 'widget', app: false, path: '/widget/vienna', settle: 3000, slices: 1 },
  { id: 'probe-recents', hidden: true, path: '/?city=Buon%20Ma%20Thuot', ready: FORECAST, steps: async x => {
    const state = () => x.ev(`JSON.stringify({ recent: decodeURIComponent((document.cookie.match(/metablend_recent=([^;]*)/) ?? [])[1] ?? ''), field: document.querySelector('.home-search input')?.value, title: document.querySelector('h1, h2')?.innerText?.replace(/\s+/g, ' ') })`)
    x.note('after typing the plain spelling', await state())
    await x.type(`document.querySelector('.home-search input')`, 'Buon Ma'); await x.sleep(2500)
    x.note('suggestions for "Buon Ma"', await x.ev(`[...document.querySelectorAll('#home-suggest [role=option], #home-suggest li')].map(o => o.innerText.replace(/\s+/g, ' ')).slice(0, 6)`))
    await x.shot('suggest', 1)
    if (await x.click(`document.querySelector('#home-suggest [role=option], #home-suggest li')`)) { await x.sleep(6000); x.note('after picking the first suggestion', await state()); await x.shot('after', 1) }
  } },
  { id: 'probe-lang', hidden: true, path: '/', ready: `!!document.querySelector('.home-search input')`, steps: async x => {
    const recent = () => x.ev(`decodeURIComponent((document.cookie.match(/metablend_recent=([^;]*)/) ?? [])[1] ?? '')`)
    await x.type(`document.querySelector('.home-search input')`, 'Wien'); await x.key('Enter'); await x.until(FORECAST, 30000); await x.sleep(1500)
    x.note('recent after "Wien" in German', await recent())
    await x.send('Network.setCookie', { name: 'metablend_lang', value: 'en', url: BASE })
    await x.send('Page.navigate', { url: BASE + '/' }); await x.until(`!!document.querySelector('.home-search input')`, 20000); await x.sleep(2500)
    await x.type(`document.querySelector('.home-search input')`, 'Vienna'); await x.key('Enter'); await x.sleep(6000)
    x.note('recent after "Vienna" in English', await recent())
    await x.shot('both', 1)
  } },
  { id: 'hike-near', hidden: true, path: '/?city=' + CITY, ready: FORECAST, steps: async x => {
    await x.send('Page.navigate', { url: BASE + '/hike' }); await x.until("document.readyState === 'complete'", 20000); await x.sleep(5000)
    await x.shot('', 2); await x.audit()
  } },
  { id: 'laws-gold', hidden: true, path: '/more', steps: async x => {
    const pages = [['first start', '/?terms=show'], ['forecast, Today', '/?city=' + CITY], ['hiking list', '/hike'], ['peak', PEAK], ['route', ROUTE], ['more', '/more'], ['rankings', '/leaderboard'], ['heatmap', '/heatmap'], ['planner', '/planner'], ['aviation', '/aviation'], ['airport', '/aviation/LOWW'], ['summit page', '/mountains/grossglockner'], ['city page', '/weather/vienna'], ['terms', '/terms'], ['support', '/support']]
    const out = {}
    for (const [name, path] of pages) {
      await x.send('Page.navigate', { url: BASE + path }); await x.until("document.readyState === 'complete'", 20000); await x.sleep(name.startsWith('forecast') || name === 'peak' || name === 'route' ? 6000 : 3000)
      if (name === 'first start') { await x.click("document.querySelector('.terms-notice button, .terms-bar button')"); await x.sleep(900) }
      out[name] = { gold: await x.laws('LAWS.gold()'), first: await x.laws('LAWS.first()') }
    }
    writeFileSync(join(OUT, 'laws-gold.json'), JSON.stringify(out, null, 1))
  } },
  { id: 'laws-speed', hidden: true, path: '/?city=' + CITY, ready: FORECAST, steps: async x => {
    await allSources(x)
    await x.slowPhone()
    const T = {}
    const act = async (name, run, done) => { T[name] = await x.laws('LAWS.act(() => { ' + run + ' }, ' + (done ? '() => ' + done : 'null') + ')'); await x.sleep(1200) }
    const tabBar = i => "document.querySelectorAll('.app-tabbar a')[" + i + "].click()"
    const btn = re => "[...document.querySelectorAll('main button')].find(b => " + re + ".test(b.innerText.trim()))"
    const h1 = re => re + ".test(document.querySelector('main h1')?.innerText ?? '')"
    await act('range tab: Week', tab(2) + '.click()', tab(2) + ".getAttribute('aria-selected') === 'true'")
    await act('range tab: Today', tab(0) + '.click()', tab(0) + ".getAttribute('aria-selected') === 'true'")
    await act('open the Sources panel', "document.querySelector('.home-more button[aria-expanded]').click()", "document.querySelector('.home-more button[aria-expanded]').getAttribute('aria-expanded') === 'true'")
    await act('save the city (star)', "[...document.querySelectorAll('.home-search button')].at(-1).click()", null)
    await act('refresh', "document.querySelector('button:has(svg.lucide-refresh-cw)').click()", null)
    await act('open the compare field', "document.querySelector('.home-search button[aria-pressed]').click()", null)
    await act('search: Enter on a new city', "const i = document.querySelector('.home-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Berlin'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))", "/Berlin/.test(document.querySelector('h2')?.innerText ?? '')")
    await x.sleep(2500)
    await act('tab bar: Hiking', tabBar(1), "location.pathname === '/hike' && !!document.querySelector('main h1')")
    await x.sleep(2000)
    await act('hiking: open a region', "[...document.querySelectorAll('main button[aria-expanded]')].find(b => /Eastern Alps/.test(b.innerText)).click()", "!![...document.querySelectorAll('main a')].find(a => /Großglockner/.test(a.innerText))")
    await act('hiking: tap a peak', "[...document.querySelectorAll('main a')].find(a => /Großglockner/.test(a.innerText)).click()", h1('/Großglockner/'))
    await x.sleep(4000)
    await act('peak: Week tab', "document.querySelectorAll('[role=tab]')[2].click()", "document.querySelectorAll('[role=tab]')[2].getAttribute('aria-selected') === 'true'")
    await act('peak: Today tab', "document.querySelectorAll('[role=tab]')[0].click()", null)
    await act('peak: tap a route', "[...document.querySelectorAll('main a, main button')].find(a => /Kalser/.test(a.innerText)).click()", h1('/Kalser/'))
    await x.sleep(5000)
    await act('route: another day', btn('/^Tomorrow$/') + '.click()', null)
    await act('route: pace Fast', btn('/^Fast$/') + '.click()', null)
    await act('route: back', btn('/All peaks/') + '.click()', h1('/Großglockner/'))
    await x.sleep(2000)
    await act('tab bar: More', tabBar(2), "location.pathname === '/more' && !!document.querySelector('main h1')")
    await x.sleep(1500)
    await act('more: °F', btn('/^°F$/') + '.click()', null)
    await act('more: Light', btn('/^Light$/') + '.click()', "document.documentElement.dataset.theme === 'light'")
    await act('more: open Rankings', "[...document.querySelectorAll('main a')].find(a => /Rankings/.test(a.innerText)).click()", "location.pathname === '/leaderboard' && !!document.querySelector('main h1')")
    await x.sleep(2500)
    await act('tab bar: Forecast', tabBar(0), "location.pathname === '/' && !!document.querySelector('.text-7xl')")
    writeFileSync(join(OUT, 'laws-speed.json'), JSON.stringify(T, null, 1))
    for (const [k, v] of Object.entries(T)) x.note(k, v)
  } },
  { id: 'probe-a11y', hidden: true, path: `/?city=${CITY}`, ready: FORECAST, steps: async x => {
    x.note('live regions', await x.ev(`[...document.querySelectorAll('[role=alert],[role=status],[aria-live]')].map(e => e.tagName + ' ' + (e.getAttribute('role') ?? '') + '/' + (e.getAttribute('aria-live') ?? '') + ': ' + e.innerText.trim().slice(0, 40))`))
    x.note('landmarks', await x.ev(`[...document.querySelectorAll('main,nav,header,footer,[role=region],[role=tablist],[role=img],svg[aria-label]')].filter(e => e.checkVisibility()).map(e => e.tagName.toLowerCase() + (e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : '') + ' "' + (e.getAttribute('aria-label') ?? '') + '"').slice(0, 30)`))
    x.note('charts', await x.ev(`[...document.querySelectorAll('main svg')].filter(e => e.getBoundingClientRect().width > 200).map(e => 'svg ' + Math.round(e.getBoundingClientRect().width) + 'px role=' + e.getAttribute('role') + ' label=' + (e.getAttribute('aria-label') ?? '').slice(0, 80) + ' hidden=' + e.getAttribute('aria-hidden') + ' smallest text ' + Math.min(...[...e.querySelectorAll('text')].map(t => Math.round(t.getBoundingClientRect().height))) + 'px high')`))
    x.note('tab bar', await x.ev(`[...document.querySelectorAll('.app-tabbar a')].map(a => a.innerText.trim() + ' current=' + a.getAttribute('aria-current') + ' ' + Math.round(a.getBoundingClientRect().width) + 'x' + Math.round(a.getBoundingClientRect().height))`))
  } },
  { id: 'faults', hidden: true, path: pathToFileURL(join(HERE, 'faults.html')).href, slices: 1 },
  { id: 'offline-app', app: true, path: pathToFileURL(join(HERE, '../../mobile/www/index.html')).href, slices: 1 },
]

const only = process.env.ONLY?.split(',')
for (const s of SCREENS) {
  if (only ? !only.includes(s.id) : s.hidden) continue
  if (s.app !== undefined && s.app !== C.app) continue
  if (s.native && !C.native) continue
  await open(s)
}
writeFileSync(CACHE_FILE, JSON.stringify(cache))
writeFileSync(join(OUT, `_summary${only ? '-' + only.join('+') : ''}.json`), JSON.stringify(summary, null, 1))
console.log(`API: ${asked} asked of the local server, ${replayed} replayed from the recording`)
for (const r of summary) console.log(r.value !== undefined ? `  ${r.screen}: ${JSON.stringify(r.value).slice(0, 900)}` : `  ${r.screen}: tap ${r.tap} (under 24: ${r.tiny}) | contrast ${r.contrast} | small ${r.small || '-'} | cut ${r.cut} | unnamed ${r.unnamed} odd ${r.odd} | icon-only ${r.icons} | wide ${r.wide} | safe ${r.safe} | problems ${r.problems}`)
await close()
process.exit(0)

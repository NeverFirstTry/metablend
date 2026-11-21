// node scripts/brand/reel-shots.mjs <stage> <build folder> [base]: the stage screenshots for the reel "MetaBlend has
// a new look" (owner 2026-11-21) into store/social/reel/shots/<stage>-<screen>-<lang>.png. The same app screens from
// three local builds, one at a time: 1-before (48603a1, the last commit whose page wore the weather sky),
// 2-slate (50bc282, solid Slate before the UX changes of 20 Nov) and 3-now (main). App view, dark, de and en,
// 390 x 844 at 3x: the page at 390 x 797 under a drawn status bar that reads 18:41.
//   For the film, which changes one stage into the next part by part, every screen is also pictured 320 px taller
//   into shots/film/, and shots/film/regions.json says where its parts are (header, search row, headline, tabs,
//   first card, the rest, tab bar): the parts are read from the page, since every stage lays them out differently.
//   In the build folder: npx next build, then SELF_BASE=http://localhost:3261 npx next start -p 3261
//   Local builds only: any other host than localhost is refused, and so is a server that answers from another build
//   than the folder's (a server left over from an earlier stage would otherwise be pictured under the new name).
//   SKY=dawn puts the old weather sky's sunrise on the page (stage 1 only: there the sky followed the hour, and the
//   pictures are taken in the evening); the film then also gets the same page on Slate (…-on-slate-…), so its
//   background can change first. ONLY=forecast,peak picks screens. OUT=<folder> writes somewhere else (a rehearsal).
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from '../lib/browser.mjs'
import { blockAnalytics } from '../lib/analytics-block.mjs'
import { TERMS_CAPTURE_SCRIPT } from '../../lib/terms.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = process.env.OUT ?? path.join(ROOT, 'store/social/reel/shots')
const FILM = path.join(OUT, 'film')
const [stage, buildDir, BASE = 'http://localhost:3261'] = process.argv.slice(2)
if (!/^[123]-(before|slate|now)$/.test(stage ?? '') || !buildDir) { console.error('usage: node scripts/brand/reel-shots.mjs <1-before|2-slate|3-now> <build folder> [base]'); process.exit(2) }
if (!/^http:\/\/localhost:\d+$/.test(BASE)) { console.error(`not a local build: ${BASE}`); process.exit(2) }
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const ONLY = process.env.ONLY?.split(',')
const SKY = process.env.SKY
const W = 390, H = 844, BAR = 47, SCALE = 3
const MORE = 320 // the film's pictures show this much more of the page, so a part that grows never uncovers an empty strip
const SLATE = '#0f151b'
const PLACE = 'Lienz'
// outside the featured list a peak opens by coordinates, as its link in Near you does (as in scripts/store-shots.mjs)
const PEAK = `lat=46.824&lon=12.693&elev=2057&name=Hochstein&cc=AT`

const buildId = fs.readFileSync(path.join(buildDir, '.next/BUILD_ID'), 'utf8').trim()
const home = await fetch(`${BASE}/?app=1`).then(r => r.text())
if (!home.includes(buildId)) { console.error(`${BASE} does not answer from the build in ${buildDir} (${buildId})`); process.exit(2) }
console.log(`${stage}: build ${buildId} at ${BASE}`)

fs.mkdirSync(FILM, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const { targets, close } = await launchBrowser(EDGE, 'reel-')
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0; const pending = new Map()
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const grab = async () => (await send('Page.captureScreenshot', { format: 'png' })).result.data
const screen = height => send('Emulation.setDeviceMetricsOverride', { width: W, height, deviceScaleFactor: SCALE, mobile: true })

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

// Where a screen's parts are, read from the page in px of the screen. No class names: the three stages are
// three versions of the code. The tab bar is the fixed block at the bottom, the tabs' box is the pill around
// the range tabs, the first card is the block right under them, and on the forecast the search row is the
// row of the first input and the headline the row of the place's name.
const PARTS = word => `(() => {
  const r = el => el.getBoundingClientRect(), vh = innerHeight, mid = innerWidth / 2
  let bar = document.elementFromPoint(mid, vh - 8)
  while (bar && getComputedStyle(bar).position !== 'fixed') bar = bar.parentElement
  const tabs = [...document.querySelectorAll('[role=tab]')]
  let box = tabs[0]
  while (box?.parentElement && r(box.parentElement).height <= r(tabs[0]).height + 28) box = box.parentElement
  if (!bar || !box) return { error: 'no tab bar or no tabs' }
  const tabsEnd = r(box).bottom
  // a wrapper without an edge or a fill that holds several blocks is not the card: its first block is
  const plain = el => { const s = getComputedStyle(el); return s.borderTopWidth === '0px' && /rgba\\(0, 0, 0, 0\\)|transparent/.test(s.backgroundColor) }
  const shown = el => [...el.children].filter(c => r(c).height > 8)
  let block = null
  for (const down of [30, 60, 100, 140]) {
    let el = document.elementFromPoint(mid, tabsEnd + down)
    while (el?.parentElement && r(el.parentElement).top >= tabsEnd - 2) el = el.parentElement
    while (el && plain(el) && shown(el).length > 1) el = shown(el)[0]
    if (el && r(el).top >= tabsEnd - 2 && r(el).bottom > tabsEnd + 20) { block = el; break }
  }
  if (!block) return { error: 'no block under the tabs' }
  const input = [...document.querySelectorAll('input')].find(i => r(i).height > 20 && r(i).top < r(box).top)
  let row = input
  while (row?.parentElement && r(row.parentElement).height <= r(input).height + 24) row = row.parentElement
  const name = [...document.querySelectorAll('h1,h2,h3,p,div,span')].find(e => e.textContent.trim().startsWith(${JSON.stringify(word)}) && parseFloat(getComputedStyle(e).fontSize) >= 24 && r(e).height > 0 && r(e).height < 120)
  let head = name
  while (head?.parentElement && r(head.parentElement).height <= r(name).height + 70) head = head.parentElement
  return { vh, bar: r(bar).top, tabs: r(box).top, tabsEnd, block: [r(block).top, r(block).bottom], search: row ? r(row).top : null, headline: head ? r(head).top : null }
})()`
// the parts as rows of the film's picture (status bar included), top to bottom without a gap
const regions = (kind, p) => {
  if (!p || p.error) throw new Error(`${kind}: ${p?.error ?? 'the page gave no parts'}`)
  const y = v => Math.round(v) + BAR, total = p.vh + BAR, under = y(p.tabsEnd) + 10, card = y(p.block[1]) + 10
  const cuts = kind === 'forecast'
    ? [['header', 0], ['search', y(p.search) - 8], ['headline', y(p.headline) - 10], ['tabs', y(p.tabs) - 10], ['card', under], ['rest', card], ['bar', y(p.bar)]]
    // the Week tab's first card is the best day's line where there is one; a first block as tall as the list is the list
    : kind === 'peak-week'
      ? [['header', 0], ['tabs', y(p.tabs) - 10], ['best', under], ['rest', p.block[1] - p.block[0] < 190 ? card : under], ['bar', y(p.bar)]]
      : [['header', 0], ['tabs', y(p.tabs) - 10], ['card', under], ['rest', card], ['bar', y(p.bar)]]
  const parts = cuts.map(([name, y0], i) => ({ name, y0, y1: cuts[i + 1]?.[1] ?? total }))
  if (parts.some(q => !(q.y0 >= 0 && q.y1 >= q.y0 && q.y1 <= total))) throw new Error(`${kind}: the parts do not follow each other: ${JSON.stringify(parts)}`)
  return { height: total, parts }
}

// the phone's status bar over the page: the page's own top row drawn upwards (any background joins without a
// seam), the time on the left, reception and battery on the right
const withBar = (page, height) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;width:${W}px;height:${height}px;overflow:hidden;background:#000}
canvas,img{display:block;width:${W}px}canvas{height:${BAR}px}img{height:${height - BAR}px}
.bar{position:absolute;left:0;top:0;width:${W}px;height:${BAR}px;color:#fff;font:600 16px/1 system-ui,'Segoe UI',sans-serif;letter-spacing:.01em}
.time{position:absolute;left:32px;top:17px}.right{position:absolute;right:26px;top:16px;display:flex;gap:6px;align-items:center}
</style></head><body><canvas width="${W * SCALE}" height="${BAR * SCALE}"></canvas><img src="data:image/png;base64,${page}">
<div class="bar"><span class="time">18:41</span><span class="right">
<svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><path d="M1.2 4.3a9.6 9.6 0 0 1 13.6 0"/><path d="M3.9 7a5.8 5.8 0 0 1 8.2 0"/><circle cx="8" cy="10" r="1.1" fill="#fff" stroke="none"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="#fff" opacity=".45"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#fff"/><path d="M25 4.5v4c.8-.3 1.5-1 1.5-2s-.7-1.7-1.5-2z" fill="#fff" opacity=".5"/></svg>
</span></div></body></html>`
const DRAW = `(async () => { const img = document.querySelector('img'); await img.decode(); const c = document.querySelector('canvas'); c.getContext('2d').drawImage(img, 0, 0, img.naturalWidth, 1, 0, 0, c.width, c.height); return true })()`

// The pages are pictured first and get their status bar at the end: drawing the bar replaces the document,
// and a page that is still needed for its next tab must not be replaced.
const pages = [], where = {}
// kind: which parts the film's picture has (forecast, peak-tomorrow, peak-week); none: no picture for the film
const save = async (name, kind = null) => {
  // the cookie notice (the old versions show it in the app too) is answered, as a reader would have
  await ev(`([...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'OK')?.click(), true)`)
  if (SKY) await ev(`(document.documentElement.dataset.sky = ${JSON.stringify(SKY)}, true)`)
  await ev(`(scrollTo({ top: 0, behavior: 'instant' }), document.activeElement?.blur?.(), true)`); await sleep(SKY ? 2600 : 600) // the sky fades in over 1.8 s
  pages.push([path.join(OUT, `${stage}-${name}.png`), H, await grab()])
  if (!kind) return
  await screen(H - BAR + MORE); await sleep(800)
  where[`${stage}-${name}`] = regions(kind, await ev(PARTS(kind === 'forecast' ? PLACE : 'Hochstein')))
  pages.push([path.join(FILM, `${stage}-${name}.png`), H + MORE, await grab()])
  if (SKY) {
    // the same page on Slate: the old sky's three colours set to it, then given back
    await ev(`(['a', 'b', 'c'].forEach(k => document.documentElement.style.setProperty('--sky-' + k, ${JSON.stringify(SLATE)})), true)`); await sleep(2600)
    pages.push([path.join(FILM, `${stage}-on-slate-${name}.png`), H + MORE, await grab()])
    await ev(`(['a', 'b', 'c'].forEach(k => document.documentElement.style.removeProperty('--sky-' + k)), true)`)
  }
  await screen(H - BAR); await sleep(400)
}
const drawBars = async () => {
  for (const [file, height, page] of pages) {
    await screen(height)
    const { frameTree } = (await send('Page.getFrameTree')).result
    await send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: withBar(page, height) })
    if (!(await ev(DRAW))) throw new Error(`${file}: the status bar was not drawn`)
    await sleep(300)
    fs.writeFileSync(file, Buffer.from(await grab(), 'base64'))
    console.log(`${path.relative(OUT, file)} ✓`)
  }
  // the parts of this stage's pictures, added to the other stages' in the same file
  const file = path.join(FILM, 'regions.json'), all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  fs.writeFileSync(file, JSON.stringify({ ...all, ...where }, null, 1) + '\n')
}

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await blockAnalytics(ws, send)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: TERMS_CAPTURE_SCRIPT })
  const { userAgent } = (await send('Browser.getVersion')).result
  await send('Network.setUserAgentOverride', { userAgent: `${userAgent} MetaBlendApp` })
  await screen(H - BAR)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  const open = async (lang, url) => {
    await send('Network.clearBrowserCookies'); await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' })
    for (const [k, v] of [['metablend_lang', lang], ['metablend_theme', 'dark'], ['metablend_app', '1']]) await send('Network.setCookie', { name: k, value: v, url: BASE + '/' })
    await send('Page.navigate', { url: BASE + url })
  }
  const want = name => !ONLY || ONLY.includes(name)
  for (const lang of ['en', 'de']) {
    if (want('forecast')) {
      await open(lang, `/?city=${encodeURIComponent(PLACE)}&app=1`)
      if (!(await settled(PLACE))) throw new Error(`${lang}: the forecast for ${PLACE} did not load`)
      // the search field stays empty, as on the store screenshots
      await ev(`(() => { const i = document.querySelector('.home-search input, input[type=search], input[type=text]'); if (i) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur() } return true })()`)
      await sleep(1500)
      console.log(`  ${lang} forecast: ${(await ev('document.body.innerText')).replace(/\s+/g, ' ').slice(0, 260)}`)
      await save(`forecast-${lang}`, 'forecast')
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
        await save(`peak-${name}-${lang}`, `peak-${name}`)
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

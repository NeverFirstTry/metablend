// Accessibility check: axe-core over the main pages in both themes and the
// brightest / darkest skies, then a Larger Text pass at double size in the
// app (text running off the screen, content left under the tab bar);
// exit 1 on any serious or critical violation or any such spot.
//   npx next build && npx next start -p 3123     (separate terminal)
//   npm run a11y                       (everything, ~25 min)
//   A11Y_ONLY=light/day,large npm run a11y   (just those variants / the large-text pass)
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE ?? 'http://localhost:3123'
const PORT = 9377
const PAGES = [
  ['/?city=Vienna', null],
  ['/?city=Vienna', 'Week'],
  ['/hike?app=1', null],
  ['/hike?peak=grossglockner&app=1', null],
  ['/more?app=1', null],
  ['/testers', null],
  ['/', null],
  ['/leaderboard', null],
  ['/planner', null],
  ['/heatmap', null],
  ['/aviation', null],
  ['/aviation/LOWW', null],
]
// Larger Text: these pages at root font 32 px (2x) in app mode, as TextScale sets it
const LARGE_PAGES = [
  ['/?city=Vienna', null], ['/?city=Vienna', 'Week'], ['/hike?app=1', null], ['/hike?peak=grossglockner&app=1', null],
  ['/more?app=1', null], ['/leaderboard', null], ['/planner', null], ['/aviation', null],
]
const LARGE_PROBE = `(async () => {
  const out = []
  const W = innerWidth
  const scrollers = [...document.querySelectorAll('*')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowX))
  const hasText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
  // folded away: outside an ancestor that clips its overflow
  const folded = (el, r) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const cs = getComputedStyle(a); if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue
    const ar = a.getBoundingClientRect(); if (r.top >= ar.bottom - 1 || r.bottom <= ar.top + 1) return true } return false }
  for (const el of document.querySelectorAll('body *')) {
    if (!hasText(el) || el.closest('.sr-only') || scrollers.some(s => s.contains(el))) continue
    const r = el.getBoundingClientRect()
    if (r.width && r.right > W + 1) out.push('off screen: "' + el.textContent.trim().slice(0, 40) + '" ends at ' + Math.round(r.right))
  }
  const bar = document.querySelector('.app-tabbar'), main = document.querySelector('main')
  if (bar && main && getComputedStyle(bar).display !== 'none') {
    scrollTo({ top: document.scrollingElement.scrollHeight, behavior: 'instant' }) // the page scrolls smoothly otherwise
    await new Promise(r => setTimeout(r, 400))
    // scrolled to the end, reachable text ends inside the viewport (text further
    // down sits in a folded, clipped section) — it must end above the bar
    let bottom = 0
    for (const el of main.querySelectorAll('*')) {
      if (!hasText(el) || el.closest('.sr-only') || getComputedStyle(el).position === 'fixed') continue
      const r = el.getBoundingClientRect()
      if (r.height && r.bottom <= innerHeight + 1 && r.bottom > bottom && !folded(el, r)) bottom = r.bottom
    }
    const top = bar.getBoundingClientRect().top
    if (bottom > top + 1) out.push('under the tab bar: content ends at ' + Math.round(bottom) + ', bar starts at ' + Math.round(top))
  }
  return [...new Set(out)].slice(0, 6)
})()`
// [theme cookie, forced sky] — the dark theme is the living sky: check its brightest skies
const ONLY = process.env.A11Y_ONLY?.split(',') ?? null
const VARIANTS = [['dark', 'day'], ['dark', 'snow'], ['dark', 'dawn'], ['dark', 'night'], ['light', 'day'], ['light', 'snow']]
  .filter(([theme, sky]) => !ONLY || ONLY.includes(`${theme}/${sky}`))
const LARGE = !ONLY || ONLY.includes('large')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'a11y-'))}`, 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40 && !targets; i++) { await sleep(250); targets = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json()).catch(() => null) }
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Network.setCookie', { name: 'metablend_consent', value: '1', url: BASE })
await send('Network.setCookie', { name: 'metablend_lang', value: 'en', url: BASE })

let bad = 0
for (const [theme, sky] of VARIANTS) {
  await send('Network.setCookie', { name: 'metablend_theme', value: theme, url: BASE })
  for (const [path, tab] of PAGES) {
    await send('Page.navigate', { url: BASE + path })
    await sleep(4500)
    // the sky loader's names fade in and out — check the page it gives way to
    for (let i = 0; i < 20 && await ev(`!!document.querySelector('.mb-loader')`); i++) await sleep(500)
    if (tab) { await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(tab)})?.click()`); await sleep(1200) }
    // pin the sky so the check covers that background whatever today's weather is
    await ev(`(() => { const h = document.documentElement; h.dataset.sky = ${JSON.stringify(sky)}; new MutationObserver(() => { if (h.dataset.sky !== ${JSON.stringify(sky)}) h.dataset.sky = ${JSON.stringify(sky)} }).observe(h, { attributes: true, attributeFilter: ['data-sky'] }) })()`)
    await sleep(2100) // the sky colours ease over 1.8 s
    await ev(AXE)
    const v = await ev(`axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => ({ id: x.id, nodes: x.nodes.map(n => n.target.join(' ') + ' — ' + (n.any[0]?.message ?? '').slice(0, 110)) })))`)
    const n = v.reduce((s, x) => s + x.nodes.length, 0)
    bad += n
    console.log(`${n ? '✗' : '✓'} ${theme}/${sky} ${path}${tab ? ` [${tab}]` : ''}${n ? `: ${n}` : ''}`)
    for (const x of v) for (const node of x.nodes.slice(0, 3)) console.log(`    ${x.id}: ${node}`)
  }
}

let cramped = 0
await send('Network.setCookie', { name: 'metablend_theme', value: 'dark', url: BASE })
await send('Network.setCookie', { name: 'metablend_app', value: '1', url: BASE })
for (const [path, tab] of LARGE ? LARGE_PAGES : []) {
  await send('Page.navigate', { url: BASE + path })
  await sleep(4500)
  for (let i = 0; i < 20 && await ev(`!!document.querySelector('.mb-loader')`); i++) await sleep(500)
  if (tab) { await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(tab)})?.click()`); await sleep(1200) }
  await ev(`(() => { const h = document.documentElement; h.style.fontSize = '32px'; h.dataset.textLarge = '1' })()`)
  await sleep(800)
  const spots = await ev(LARGE_PROBE)
  cramped += spots.length
  console.log(`${spots.length ? '✗' : '✓'} large text ${path}${tab ? ` [${tab}]` : ''}${spots.length ? `: ${spots.length}` : ''}`)
  for (const s of spots) console.log(`    ${s}`)
}
ws.close(); edge.kill()
console.log(bad ? `\n${bad} serious/critical violations` : '\nNo serious or critical violations')
console.log(cramped ? `${cramped} spots cut off or hidden at large text` : 'Nothing cut off at large text')
process.exit(bad || cramped ? 1 : 0)

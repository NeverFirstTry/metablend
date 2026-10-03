// Accessibility check: axe-core over the main pages in both themes and the
// brightest / darkest skies; exit 1 on any serious or critical violation.
//   npx next build && npx next start -p 3123     (separate terminal)
//   npm run a11y
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
]
// [theme cookie, forced sky] — the dark theme is the living sky: check its brightest skies
const VARIANTS = [['dark', 'day'], ['dark', 'snow'], ['dark', 'dawn'], ['dark', 'night'], ['light', 'day'], ['light', 'snow']]
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
ws.close(); edge.kill()
console.log(bad ? `\n${bad} serious/critical violations` : '\nNo serious or critical violations')
process.exit(bad ? 1 : 0)

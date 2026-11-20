// Builds a UX review from its one data file: the pictures (cut out of the walk's captures), the Markdown
// report and the page with the pictures, so the three cannot drift apart.
//   node scripts/ux/report-build.mjs <report source .mjs> <docs folder> <page out file>
// The source exports head, sections and tail (see docs/ux-review/report.mjs). A picture is cut from the walk's
// folder (OUT, default the system's temp folder); when that capture is not there, the picture already in
// <docs folder>/ux-review/ is kept, so texts can be changed without a new walk.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
const [SOURCE, DOCS, PAGE] = process.argv.slice(2)
if (!SOURCE || !DOCS || !PAGE) { console.log('usage: node scripts/ux/report-build.mjs <report source .mjs> <docs folder> <page out file>'); process.exit(2) }
const R = await import(pathToFileURL(resolve(SOURCE)).href)
const CAPTURES = process.env.OUT ?? join(tmpdir(), 'metablend-ux-walk')
const PICS = join(DOCS, 'ux-review')
mkdirSync(PICS, { recursive: true })

const PRIO = { submission: 'Before submission (3 Dec)', launch: 'Before launch', after: 'After launch' }
const items = R.sections.flatMap(s => s.items)
const ids = new Set()
for (const i of items) { if (ids.has(i.id)) throw new Error(`id twice: ${i.id}`); ids.add(i.id); if (!PRIO[i.prio]) throw new Error(`${i.id}: prio`); if (!['small', 'medium', 'large'].includes(i.effort)) throw new Error(`${i.id}: effort`) }

// a picture: { src: '<walk folder>/<file>', crop: [y0, y1] or [x0, y0, x1, y1] in the page's own pixels, cap }
// The sharp retake (folder + '-2x') is used when it exists.
const W = { app: 390, native: 390, webphone: 390, web: 1280 }
async function cut(id, n, shot) {
  const [folder, file] = shot.src.split('/')
  if (/impressum/i.test(file)) throw new Error(`${id}: the Impressum shows the address and is never used`)
  const name = `${id}${n ? '-' + (n + 1) : ''}.png`
  const sharpDir = join(CAPTURES, `${folder}-2x`, file)
  const from = existsSync(sharpDir) ? sharpDir : join(CAPTURES, folder, file)
  if (!existsSync(from)) {
    // no capture on this machine: keep the picture the report already has
    if (!existsSync(join(PICS, name))) throw new Error(`${id}: no capture ${shot.src} and no picture ${name}`)
    const kept = readFileSync(join(PICS, name)), km = await sharp(kept).metadata()
    return { name, cap: shot.cap ?? '', w: Math.round(km.width / 2), data: `data:image/png;base64,${kept.toString('base64')}`, bytes: kept.length }
  }
  const meta = await sharp(from).metadata()
  const cssW = W[folder.split('-')[0]] ?? 390, k = meta.width / cssW
  let [x0, y0, x1, y1] = shot.crop?.length === 4 ? shot.crop : [0, shot.crop?.[0] ?? 0, cssW, shot.crop?.[1] ?? meta.height / k]
  y1 = Math.min(y1, meta.height / k); x1 = Math.min(x1, cssW)
  let img = sharp(from).extract({ left: Math.round(x0 * k), top: Math.round(y0 * k), width: Math.round((x1 - x0) * k), height: Math.round((y1 - y0) * k) })
  const outW = Math.round((x1 - x0) * k)
  if (outW > 1560) img = img.resize({ width: 1560 })
  const buf = await img.png({ palette: true, quality: 90, compressionLevel: 9, effort: 8 }).toBuffer()
  writeFileSync(join(PICS, name), buf)
  return { name, cap: shot.cap ?? '', w: Math.round(x1 - x0), data: `data:image/png;base64,${buf.toString('base64')}`, bytes: buf.length }
}
let bytes = 0
for (const i of items) { i.pics = []; for (const [n, shot] of (i.shots ?? []).entries()) { const p = await cut(i.id, n, shot); bytes += p.bytes; i.pics.push(p) } }

// --- the Markdown file
const md = []
const HEAD = R.head.replace(/^## MetaBlend/m, '# MetaBlend').replace(/^### /gm, '## ')
md.push(HEAD.trim(), '')
md.push('## All problems, by screen', '', `${items.length} entries. Each has an id for reference, the picture it was seen on (folder \`docs/ux-review/\`), a suggested fix, the effort (small: under half a day, medium: one to two days, large: more) and when it should be done.`, '')
md.push('| When | Count |', '| --- | --- |', ...Object.entries(PRIO).map(([k, v]) => `| ${v} | ${items.filter(i => i.prio === k).length} |`), '')
for (const s of R.sections) {
  md.push(`### ${s.title}`, '')
  if (s.note) md.push(s.note, '')
  for (const i of s.items) {
    md.push(`#### ${i.id}. ${i.title}`, '')
    md.push(`- **What is wrong:** ${i.what}`, `- **Why it matters:** ${i.why}`, `- **Suggested fix:** ${i.fix}`, `- **Effort:** ${i.effort}. **Priority:** ${PRIO[i.prio]}.`)
    if (i.where) md.push(`- **Where in the code:** ${i.where}`)
    md.push('')
    for (const p of i.pics) md.push(`![${i.id}: ${p.cap}](ux-review/${p.name})`, '', `*${p.cap}*`, '')
  }
}
md.push(R.tail.trim(), '')
writeFileSync(join(DOCS, 'ux-review.md'), md.join('\n'))

// --- the page
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const rich = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
const mdBlock = text => text.trim().split(/\n{2,}/).map(b => {
  if (/^#{1,3} /.test(b)) { const n = b.match(/^#+/)[0].length; return `<h${n}>${rich(b.replace(/^#+ /, ''))}</h${n}>` }
  if (/^\|/.test(b)) { const rows = b.split('\n').filter(r => !/^\|\s*-/.test(r)).map(r => r.split('|').slice(1, -1).map(c => c.trim())); return `<div class="scroll"><table><thead><tr>${rows[0].map(c => `<th>${rich(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` }
  if (/^(- |\d+\. )/.test(b)) { const ol = /^\d+\. /.test(b); return `<${ol ? 'ol' : 'ul'}>${b.split(/\n(?=- |\d+\. )/).map(l => `<li>${rich(l.replace(/^(- |\d+\. )/, '').replace(/\n\s+/g, ' '))}</li>`).join('')}</${ol ? 'ol' : 'ul'}>` }
  if (/^> /.test(b)) return `<blockquote>${rich(b.replace(/^> ?/gm, ''))}</blockquote>`
  return `<p>${rich(b.replace(/\n/g, ' '))}</p>`
}).join('\n')
const card = i => `<article class="item" data-prio="${i.prio}" id="${i.id}">
  <header><span class="id">${i.id}</span><h4>${rich(i.title)}</h4><span class="chips"><span class="chip p-${i.prio}">${PRIO[i.prio]}</span><span class="chip">${i.effort}</span></span></header>
  <div class="body"><div class="text">
    <p><strong>What is wrong.</strong> ${rich(i.what)}</p><p><strong>Why it matters.</strong> ${rich(i.why)}</p><p><strong>Suggested fix.</strong> ${rich(i.fix)}</p>
  </div>${i.pics.length ? `<div class="pics">${i.pics.map(p => `<figure><img loading="lazy" src="${p.data}" alt="${esc(p.cap)}" style="width:${Math.min(p.w, 640)}px"><figcaption>${esc(p.cap)}</figcaption></figure>`).join('')}</div>` : ''}</div>
</article>`
const page = `<title>MetaBlend UX Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root { --bg: #f6f7f8; --panel: #ffffff; --fg: #16202a; --muted: #5b6672; --line: #dfe3e8; --accent: #7a5a00; --accent-bg: #f7ecd0; --sub: #9a2f1f; --sub-bg: #fbe6e1; --launch: #7a5a00; --launch-bg: #f7ecd0; --after: #46525e; --after-bg: #e7eaee; --code: #eceff2; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0f151b; --panel: #161e26; --fg: #e6e9ec; --muted: #9aa5b1; --line: #27323d; --accent: #ffd98a; --accent-bg: #3a3116; --sub: #ffb4a6; --sub-bg: #43201a; --launch: #ffd98a; --launch-bg: #3a3116; --after: #b6c0ca; --after-bg: #26303a; --code: #1d2730; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #0f151b; --panel: #161e26; --fg: #e6e9ec; --muted: #9aa5b1; --line: #27323d; --accent: #ffd98a; --accent-bg: #3a3116; --sub: #ffb4a6; --sub-bg: #43201a; --launch: #ffd98a; --launch-bg: #3a3116; --after: #b6c0ca; --after-bg: #26303a; --code: #1d2730; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 16px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { max-width: 1120px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 4px; text-wrap: balance; }
h2 { font-size: 1.4rem; margin: 44px 0 10px; text-wrap: balance; }
h3 { font-size: 1.12rem; margin: 30px 0 8px; }
h4 { font-size: 1rem; margin: 0; flex: 1 1 240px; min-width: 0; }
p, li { max-width: 72ch; } p { margin: 0 0 10px; } ul, ol { padding-left: 22px; margin: 0 0 12px; } li { margin-bottom: 4px; }
.lead { color: var(--muted); margin-bottom: 20px; }
code { background: var(--code); border-radius: 4px; padding: 1px 5px; font-size: 0.875em; }
blockquote { margin: 0 0 12px; padding: 10px 14px; border-left: 3px solid var(--accent); background: var(--panel); max-width: 72ch; }
.scroll { overflow-x: auto; margin-bottom: 14px; } table { border-collapse: collapse; font-size: 0.9375rem; } th, td { text-align: left; padding: 7px 14px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; } th { color: var(--muted); font-weight: 600; }
.filter { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding: 10px 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-bottom: 1px solid var(--line); margin: 18px 0 8px; }
.filter span { color: var(--muted); font-size: 0.875rem; margin-right: 4px; }
.filter button { font: inherit; font-size: 0.875rem; padding: 8px 14px; min-height: 40px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--fg); cursor: pointer; }
.filter button[aria-pressed="true"] { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); font-weight: 600; }
.filter button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.item { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 14px; }
.item header { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: baseline; margin-bottom: 10px; }
.id { font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; } .chip { font-size: 0.8125rem; padding: 2px 9px; border-radius: 999px; background: var(--after-bg); color: var(--after); white-space: nowrap; }
.chip.p-submission { background: var(--sub-bg); color: var(--sub); font-weight: 600; } .chip.p-launch { background: var(--launch-bg); color: var(--launch); }
.body { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-start; } .text { flex: 1 1 340px; min-width: 0; } .text p { font-size: 0.9375rem; }
.pics { display: flex; flex-wrap: wrap; gap: 12px; min-width: 0; max-width: 100%; } figure { margin: 0; max-width: 100%; } figure img { display: block; max-width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--line); } figcaption { font-size: 0.8125rem; color: var(--muted); margin-top: 5px; max-width: 46ch; }
.count { color: var(--muted); font-size: 0.875rem; }
[hidden] { display: none !important; }
</style>
<div class="wrap">
${mdBlock(HEAD)}
<h2>All problems, by screen</h2>
<p class="lead">${items.length} entries. Small: under half a day. Medium: one to two days. Large: more.</p>
<div class="filter" role="group" aria-label="Show by priority"><span>Show</span>
<button type="button" data-f="all" aria-pressed="true">All (${items.length})</button>
${Object.entries(PRIO).map(([k, v]) => `<button type="button" data-f="${k}" aria-pressed="false">${v} (${items.filter(i => i.prio === k).length})</button>`).join('\n')}
</div>
${R.sections.map(s => `<section class="screen"><h3>${esc(s.title)}</h3>${s.note ? `<p class="lead">${rich(s.note)}</p>` : ''}${s.items.map(card).join('\n')}</section>`).join('\n')}
${mdBlock(R.tail)}
</div>
<script>
const buttons = [...document.querySelectorAll('.filter button')]
for (const b of buttons) b.addEventListener('click', () => {
  for (const o of buttons) o.setAttribute('aria-pressed', String(o === b))
  for (const it of document.querySelectorAll('.item')) it.hidden = b.dataset.f !== 'all' && it.dataset.prio !== b.dataset.f
  for (const s of document.querySelectorAll('.screen')) s.hidden = b.dataset.f !== 'all' && ![...s.querySelectorAll('.item')].some(i => !i.hidden)
})
</script>
`
writeFileSync(PAGE, page)
console.log(`${items.length} entries, ${items.reduce((n, i) => n + i.pics.length, 0)} pictures, ${(bytes / 1e6).toFixed(2)} MB; page ${(page.length / 1e6).toFixed(2)} MB`)
for (const [k, v] of Object.entries(PRIO)) console.log(`  ${v}: ${items.filter(i => i.prio === k).length}`)

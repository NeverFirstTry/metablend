// Distinct measured items of one configuration of the UX walk (walk.mjs), with the screens each was seen on.
//   node scripts/ux/summary.mjs <config> [tap unnamed odd contrast small cut icons hues safe dashes problems sizes h1 wide]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const [name, ...want] = process.argv.slice(2)
const dir = join(process.env.OUT ?? join(tmpdir(), 'metablend-ux-walk'), name)
const files = readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'))
const all = files.map(f => ({ screen: f.replace('.json', ''), ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
const group = (pick, key, show) => { const m = new Map(); for (const a of all) for (const it of pick(a) ?? []) { const k = key(it); const e = m.get(k) ?? { it, screens: [] }; e.screens.push(a.screen); m.set(k, e) } return [...m.values()].map(e => `${show(e.it)}  [${e.screens.length > 4 ? e.screens.slice(0, 4).join(', ') + ` +${e.screens.length - 4}` : e.screens.join(', ')}]`) }
const out = {
  tap: () => group(a => a.tap, t => `${t.where}|${t.box}`, t => `${t.reach} (box ${t.box}) x${t.n} ${JSON.stringify(t.names).slice(0, 70)} ${t.where.slice(0, 60)}`).sort(),
  unnamed: () => group(a => a.unnamed, u => u.html.slice(0, 80), u => `${u.role}: ${u.html.slice(0, 150)}`),
  odd: () => group(a => a.oddNames, u => u.name + u.html.slice(0, 50), u => `${u.role} "${u.name}": ${u.html.slice(0, 120)}`),
  contrast: () => group(a => a.contrast, c => `${c.fg}|${c.bg}|${c.px}`, c => `${c.ratio}:1 (needs ${c.need}) ${c.fg} on ${c.bg} ${c.px}px${c.picture ? ' over a picture' : ''} x${c.n} ${JSON.stringify(c.samples).slice(0, 90)} ${c.where.slice(0, 40)}`),
  small: () => group(a => a.small, s => String(s.px), s => `${s.px}px x${s.n} ${JSON.stringify(s.samples)}`),
  cut: () => group(a => a.cut, c => c.text.slice(0, 30), c => `"${c.text.slice(0, 60)}" shown ${c.shown} of ${c.full}px ${c.where.slice(0, 50)}`),
  icons: () => group(a => a.icons, i => `${i.label}|${i.where}`, i => `"${i.label}" ${i.w}x${i.h} x${i.n} ${i.where.slice(0, 50)}`),
  hues: () => group(a => a.hues.filter(h => !['gold', 'green', 'red', 'orange'].includes(h.hue)), h => h.hue + h.samples[0]?.slice(0, 40), h => `${h.hue} x${h.n}: ${h.samples.join(' ; ').slice(0, 200)}`),
  safe: () => group(a => a.safe, s => s.slice(0, 40), s => s),
  dashes: () => group(a => a.dashes, s => s.slice(0, 30), s => s),
  problems: () => group(a => a.problems, s => s.slice(0, 50), s => s),
  sizes: () => { const m = new Map(); for (const a of all) for (const s of a.sizes) { const [px, n] = s.split('px x'); m.set(+px, (m.get(+px) ?? 0) + +n) } return [[...m.entries()].sort((a, b) => a[0] - b[0]).map(([px, n]) => `${px}px:${n}`).join('  ')] },
  h1: () => all.filter(a => a.h1 !== 1).map(a => `${a.screen}: ${a.h1} h1`),
  wide: () => all.filter(a => a.docW > a.w).map(a => `${a.screen}: ${a.docW} > ${a.w}`),
}
for (const k of want.length ? want : Object.keys(out)) { const rows = out[k](); console.log(`\n== ${k} (${rows.length})`); for (const r of rows.slice(0, 60)) console.log('  ' + r) }

// Every colour the app's code uses has a light-theme value that reads (owner, 2026-11-22, after Build's observation
// 0105: the More pickers' bg-zinc-700 had none, so dark text sat on dark grey for two days, on the website and in
// the app). The JSX is written in the dark palette and the light theme remaps its colour classes in app/globals.css;
// a class missing there keeps its dark value. This test reads the light blocks the way the cascade treats one
// element: the rules whose classes the element carries win by specificity, then by order, and any of them beats the
// utility itself (Tailwind's utilities sit in a layer, these rules do not). It checks, in the light theme:
//  1. each colour class in app/ and lib/ code gets a light value with the classes it stands with, or has a reason
//     in LOOKS_SAME (a colour that is meant to look the same in both themes);
//  2. text on its element's background, or on the page and on a card when it sets none, clears 4.5:1, in each state
//     its classes name (hover, focus, sm, ...); a focus mark clears 3:1;
//  3. each colour token of the dark theme has a light value, and text set in a token from a style clears 4.5:1.
// shortcut: one class string at a time, so a background on a parent and the text in a child are not paired, and a
// class built at run time (`text-${tone}`) or a raw colour in a style object is not seen; widen it when one slips by.
// Also not read (Review, 2026-11-22): the website's design layer (html:not([data-app]):not(.\#):not(.\#) main …),
// which outranks the light rules on the website, so a colour it sets there is judged by the remap instead; light
// rules inside @media (this only makes the check stricter); :not() is dropped from a selector (the one in a light
// block, .divide-zinc-800 > :not(:last-child), sets a border only); rules on a class inside another class are skipped.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// Colours meant to look the same in both themes, each with its reason. A class here is not a finding for lacking a
// light value; text on it is still measured where its value is known (an arbitrary colour).
const LOOKS_SAME = {
  'border-zinc-500': 'a mid grey edge (a chosen chip, the saved star), seen on dark and on light alike',
  'border-zinc-600': "the edge of the aviation page's flight-rules badge, a mid grey seen on both",
  'hover:bg-red-500/10': 'a faint red tint on hover; the text on it keeps its own colour',
  'bg-amber-400': 'the saved city star: an amber fill with black text (about 11:1), the same in both themes',
  'text-black': 'black text, only on light fills (the saved star; on the main buttons the light rules set it)',
  'bg-[#0f151b]': "the film's frame: the film's own dark first frame, the same in both themes, no text on it",
  'ring-white/20': 'a faint edge on the app icon picture of the press page; on light it fades into the page, harmless',
}

// ── colours ─────────────────────────────────────────────────────────────────────────────────────────────────────
const UNKNOWN = Symbol('unknown')
function colour(v, tok, depth = 0) {
  if (v == null || depth > 8) return null
  v = String(v).replace(/!important/, '').trim().replace(/_/g, ' ')
  let m
  if ((m = v.match(/^var\(--([\w-]+)\s*(?:,\s*(.+))?\)$/))) return colour(tok(m[1]) ?? m[2], tok, depth + 1)
  if (v === 'transparent' || v === 'none') return [0, 0, 0, 0]
  if (v === 'white') return [255, 255, 255, 1]
  if (v === 'black') return [0, 0, 0, 1]
  if ((m = v.match(/^#([0-9a-f]{3,8})$/i))) {
    let h = m[1]
    if (h.length <= 4) h = [...h].map(x => x + x).join('')
    const n = [0, 2, 4, 6].map(i => parseInt(h.slice(i, i + 2), 16))
    return [n[0], n[1], n[2], h.length === 8 ? n[3] / 255 : 1]
  }
  if ((m = v.match(/^rgba?\(([^)]*)\)$/))) {
    const n = m[1].split(/[\s,/]+/).filter(Boolean).map(x => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x)))
    return [n[0], n[1], n[2], n[3] ?? 1]
  }
  if ((m = v.match(/^color-mix\(in [\w-]+,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*transparent\)$/))) {
    const c = colour(m[1], tok, depth + 1)
    return c && [c[0], c[1], c[2], (c[3] * Number(m[2])) / 100]
  }
  return null
}
const over = (c, base) => [0, 1, 2].map(i => c[i] * c[3] + base[i] * (1 - c[3])).concat(1)
const lum = c => {
  const [r, g, b] = c.slice(0, 3).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const hex = c => `#${c.slice(0, 3).map(x => Math.round(x).toString(16).padStart(2, '0')).join('')}`

// ── the style sheet ─────────────────────────────────────────────────────────────────────────────────────────────
// one nesting level: its declarations and its rules (selector, body, position)
function level(text, base = 0) {
  const props = new Map(), rules = []
  const decl = d => { const k = d.indexOf(':'); if (k > 0 && !d.trim().startsWith('@')) props.set(d.slice(0, k).trim(), d.slice(k + 1).replace(/!important/, '').trim()) }
  let start = 0, i = 0
  while (i < text.length) {
    if (text[i] === ';') { decl(text.slice(start, i)); start = i + 1 } else if (text[i] === '{') {
      let n = 1, j = i + 1
      while (n && j < text.length) { if (text[j] === '{') n++; else if (text[j] === '}') n--; j++ }
      rules.push({ sel: text.slice(start, i).trim(), body: text.slice(i + 1, j - 1), at: base + i + 1 })
      i = j; start = j; continue
    }
    i++
  }
  if (text.slice(start).trim()) decl(text.slice(start))
  return { props, rules }
}
const splitTop = (s, re) => {
  const out = []; let d = 0, cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') { cur += ch + s[++i]; continue }
    if (ch === '(') d++
    if (ch === ')') d--
    if (!d && re.test(ch)) { out.push(cur); cur = '' } else cur += ch
  }
  return [...out, cur].map(x => x.trim()).filter(Boolean)
}
const CLASS = /\.((?:\\.|[\w-])+)/g
function compound(s) {
  const tags = []
  s = s.replace(/:is\(([^)]*)\)/g, (_, a) => { tags.push(...a.split(',').map(x => x.trim())); return '' }).replace(/:not\([^)]*\)/g, '')
  const tag = s.match(/^[a-z][\w-]*/)
  if (tag) tags.push(tag[0])
  const classes = [...s.matchAll(CLASS)].map(x => x[1].replace(/\\(.)/g, '$1'))
  const state = s.replace(CLASS, '').match(/:(hover|focus-visible|focus-within|focus|active)\b/)?.[1] ?? null
  return { tags: tags.length ? tags : null, classes, state }
}
const SCOPES = {
  ':root': { themes: ['dark', 'light'], spec: 10 },
  '[data-theme="light"]': { themes: ['light'], spec: 10 },
  ':root[data-theme="light"]': { themes: ['light'], spec: 20 },
  ':root:not([data-theme="light"])': { themes: ['dark'], spec: 20 },
}
const LIGHT_BLOCKS = { '[data-theme="light"]': 1, ':root[data-theme="light"]': 2 }

export function readSheet(css) {
  const top = level(css.replace(/\/\*[\s\S]*?\*\//g, '')).rules
  const defs = []
  for (const r of top) {
    const scope = SCOPES[r.sel]
    if (!scope) continue
    for (const [name, value] of level(r.body).props) if (name.startsWith('--')) defs.push({ name: name.slice(2), value, ...scope, at: r.at })
  }
  const token = theme => name => defs.filter(d => d.name === name && d.themes.includes(theme))
    .sort((a, b) => b.spec - a.spec || b.at - a.at)[0]?.value ?? null
  const rules = []
  const add = (rest, props, at, blockB) => {
    const parts = splitTop(rest, /[\s>+~]/).map(compound)
    // the element the declarations land on: one compound, or a class whose children it styles (.divide-* > *)
    if (parts.slice(1).some(p => p.classes.length)) return
    const t = parts[0]
    rules.push({ ...t, props, at, b: blockB + t.classes.length + (t.state ? 1 : 0), c: t.tags ? 1 : 0 })
  }
  for (const r of top) {
    const parts = splitTop(r.sel, /,/)
    if (LIGHT_BLOCKS[r.sel]) {
      for (const n of level(r.body, r.at).rules) {
        const { props } = level(n.body)
        for (const p of splitTop(n.sel, /,/)) if (p.startsWith('&')) add(p.slice(1).trim(), props, n.at, LIGHT_BLOCKS[r.sel])
      }
    } else {
      for (const p of parts) {
        const m = p.match(/^(:root\[data-theme="light"\]|\[data-theme="light"\])\s+(.+)$/)
        if (m) add(m[2], level(r.body).props, r.at, LIGHT_BLOCKS[m[1]])
      }
    }
  }
  return { rules, light: token('light'), dark: token('dark'), defs }
}

// ── the code's colour classes ───────────────────────────────────────────────────────────────────────────────────
const HUES = 'zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PROP = { text: 'color', bg: 'background-color', border: 'border-color', divide: 'border-color', ring: '--tw-ring-color', outline: 'outline-color', accent: 'accent-color', fill: 'fill', stroke: 'stroke', from: '--tw-gradient-from', via: '--tw-gradient-via', to: '--tw-gradient-to', shadow: '--tw-shadow-color', decoration: 'text-decoration-color', caret: 'caret-color' }
const UTIL = new RegExp(String.raw`^((?:[\w-]+:)*)(!?)(text|bg|border(?:-[trblxy])?|divide|ring|outline|accent|fill|stroke|from|via|to|shadow|decoration|caret)-((?:${HUES})-\d{2,3}|white|black|\[[^\]]+\])(\/\d{1,3})?(!?)$`)
export function util(t) {
  const m = t.match(UTIL)
  if (!m) return null
  const [, pre, bang, kind, val, alpha, bang2] = m
  let known = null, themed = false
  if (val.startsWith('[')) {
    known = val.slice(1, -1).replace(/_/g, ' ')
    if (!/^(#|rgba?\(|var\(--|color-mix\()/.test(known)) return null
    themed = known.includes('var(--') // a token: its light value is the token's
  } else if (val === 'white' || val === 'black') known = val
  if (known && alpha) known = `color-mix(in srgb, ${known} ${alpha.slice(1)}%, transparent)`
  // important (!): it beats the light rules too, so it shows as it is
  return { cls: t, state: pre.slice(0, -1) || 'rest', prop: PROP[kind.replace(/-[trblxy]$/, '')], known, themed, important: !!(bang || bang2) }
}

// the class strings of a source: quoted strings, and a template's fixed part with each string inside its ${…}
export function classStrings(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
  const out = []
  for (const m of src.matchAll(/`((?:\\[\s\S]|[^`\\])*)`/g)) {
    let fixed = ''; const inner = []
    for (let t = m[1], i = 0; i < t.length;) {
      if (t[i] === '$' && t[i + 1] === '{') {
        let d = 1, j = i + 2
        while (d && j < t.length) { if (t[j] === '{') d++; else if (t[j] === '}') d--; j++ }
        for (const s of t.slice(i + 2, j - 1).matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) inner.push(s[1] ?? s[2])
        fixed += ' '; i = j
      } else fixed += t[i++]
    }
    out.push(fixed, ...inner.map(s => `${fixed} ${s}`))
  }
  for (const m of src.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) out.push(m[1] ?? m[2])
  // a tone table's box with the colour its text is given ({ box: '…', color: 'var(--x)' }, the Headline's)
  for (const m of src.matchAll(/\bbox:\s*'([^']*)',\s*color:\s*'(var\(--[\w-]+\))'/g)) out.push(`${m[1]} text-[${m[2]}]`)
  return [...new Set(out.map(s => s.trim().replace(/\s+/g, ' ')))]
    .filter(s => s && s.split(' ').every(t => /^[^'"`{}<>;=]+$/.test(t)) && s.split(' ').some(util))
}

// ── the check ───────────────────────────────────────────────────────────────────────────────────────────────────
export function check(sheet, units, looksSame = LOOKS_SAME) {
  const { rules, light: tok } = sheet
  const card = colour(tok('glass') ?? tok('surface') ?? '#ffffff', tok)
  const skies = ['sky-a', 'sky-b', 'sky-c'].map(n => colour(tok(n), tok)).filter(Boolean)
  const sky = skies.sort((a, b) => lum(a) - lum(b))[0] ?? card
  const ink = colour('var(--foreground)', tok)
  const out = new Set(), seen = new Set()
  for (const { where, text } of units) {
    const names = text.split(' '), has = new Set(names), utils = names.map(util).filter(Boolean)
    const states = ['rest', ...new Set(utils.map(u => u.state).filter(s => s !== 'rest'))]
    for (const state of states) {
      const on = state.split(':')
      if (on.includes('focus-visible')) on.push('focus') // a focus-visible element is focused too
      for (const tag of [null, 'button']) {
        const pick = prop => rules.filter(r => r.props.has(prop) && r.classes.every(c => has.has(c))
          && (!r.state || on.includes(r.state)) && (!r.tags || (tag && r.tags.includes(tag))))
          .sort((a, b) => b.b - a.b || b.c - a.c || b.at - a.at)[0]
        // the utility as it is: a token is themed already, anything else needs a reason to look the same
        const shows = u => {
          if (!u.themed && !looksSame[u.cls]) out.add(`${where}: "${text}": ${u.cls} has no light value${state === 'rest' ? '' : ` (${state})`}`)
          return (u.known && colour(u.known, tok)) || UNKNOWN
        }
        const value = prop => {
          const asked = utils.filter(u => u.prop === prop && (u.state === 'rest' || u.state === state))
          const strong = asked.find(x => x.important && x.state === state) ?? asked.find(x => x.important)
          if (strong) return shows(strong)
          const r = pick(prop)
          if (r) return colour(r.props.get(prop), tok) ?? UNKNOWN
          if (!asked.length) return null
          return shows(asked.find(x => x.state === state) ?? asked.at(-1)) // the state's own one wins over the resting one
        }
        const fg = value('color'), bg = value('background-color')
        for (const prop of new Set(utils.map(u => u.prop))) value(prop) // every other colour needs its light value too
        // text the element colours itself; one that inherits its colour sits on a parent this test does not see
        if (fg !== null) {
          const f = fg, g = bg ?? [0, 0, 0, 0]
          const key = `${where}|${text}|${state}`
          if (f !== UNKNOWN && g !== UNKNOWN && !seen.has(key)) {
            const worst = [card, sky].map(base => { const b = over(g, base), t = over(f, b); return { t, b, r: ratio(t, b) } }).sort((a, b) => a.r - b.r)[0]
            if (worst.r < 4.5) { seen.add(key); out.add(`${where}: "${text}"${state === 'rest' ? '' : ` (${state})`}${tag ? ' on a button' : ''}: text ${hex(worst.t)} on ${hex(worst.b)} is ${worst.r.toFixed(2)}:1, under 4.5:1`) }
          }
        }
        // a focus mark has to be seen: 3:1 against the page and a card
        if (/focus/.test(state)) {
          const marks = new Set(utils.filter(u => u.state === state).map(u => u.prop))
          for (const prop of ['border-color', '--tw-ring-color', 'outline-color'].filter(p => marks.has(p))) {
            const v = value(prop)
            if (!v || v === UNKNOWN) continue
            const r = Math.min(...[card, sky].map(base => ratio(over(v, base), base)))
            if (r < 3) out.add(`${where}: "${text}" (${state}): the focus mark ${hex(over(v, card))} is ${r.toFixed(2)}:1, under 3:1`)
          }
        }
      }
    }
  }
  return [...out]
}

const sheet = readSheet(read('app/globals.css'))
const files = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
  .filter(f => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f) && !f.startsWith('lib/i18n/'))
const sources = files.map(f => ({ f, src: read(f) }))

// source-match-ok: the light theme is a style sheet over the dark classes; no render here applies a style sheet
test('light theme: every colour class the code uses has a light value that reads', () => {
  const units = sources.flatMap(({ f, src }) => classStrings(src).map(text => ({ where: f, text })))
  assert.ok(units.length > 300, `the class strings were found (${units.length})`)
  assert.deepEqual(check(sheet, units), [])
})

// source-match-ok: the tokens are style sheet values; the code's text colours are read from its style objects
test('light theme: every colour token has a light value, and text set in a token reads', () => {
  const darkNames = [...new Set(sheet.defs.filter(d => d.themes.includes('dark')).map(d => d.name))]
    .filter(n => { const v = sheet.dark(n); return v && v !== 'none' && !v.includes('var(--') && colour(v, sheet.dark) })
  const lightOnly = new Set(sheet.defs.filter(d => !d.themes.includes('dark')).map(d => d.name))
  assert.deepEqual(darkNames.filter(n => !lightOnly.has(n)), [], 'colour tokens without a light value')
  const card = colour(sheet.light('glass'), sheet.light), sky = colour(sheet.light('sky-a'), sheet.light)
  const weak = []
  for (const { f, src } of sources) {
    for (const m of src.matchAll(/\bcolor:\s*['"`]var\(--([\w-]+)\)['"`]/g)) {
      const c = colour(`var(--${m[1]})`, sheet.light)
      if (!c) { weak.push(`${f}: --${m[1]} has no light value`); continue }
      const r = Math.min(ratio(over(c, card), card), ratio(over(c, sky), sky))
      if (r < 4.5) weak.push(`${f}: text in --${m[1]} ${hex(c)} is ${r.toFixed(2)}:1`)
    }
  }
  assert.deepEqual([...new Set(weak)], [])
})

test('the check finds what it is for (planted faults)', () => {
  const css = `[data-theme="light"] {\n  --foreground: #141c2b; --glass: #ffffff; --sky-a: #f3f6fb; --accent: #966400;\n}\n:root[data-theme="light"] {\n  & .text-white { color: var(--foreground); }\n  & .text-zinc-300 { color: #c9ccd1; }\n  & .text-zinc-400 { color: #3f4a5a; }\n  & .bg-zinc-800 { background-color: rgb(20 28 43 / 0.06); }\n  & .border-zinc-800 { border-color: rgb(20 28 43 / 0.08); }\n  & .focus\\:border-zinc-700:focus { border-color: #eeeeee; }\n}\n`
  const run = (text, extra = '') => check(readSheet(css + extra), [{ where: 'x.jsx', text }], {})
  // Build's bug of 2026-11-22: a dark background with no light value under text the light theme turns dark
  assert.match(run('press bg-zinc-700 text-white font-semibold').join('\n'), /bg-zinc-700 has no light value/)
  assert.deepEqual(run('bg-zinc-700 text-white', ':root[data-theme="light"] { & .bg-zinc-700.text-white { background-color: #dfe3e9; } }'), [])
  // a light value that does not read, on the page or on its own background
  assert.match(run('text-zinc-300').join('\n'), /under 4\.5:1/)
  assert.match(run('bg-zinc-800 text-zinc-300').join('\n'), /under 4\.5:1/)
  // a hover colour only the dark theme has, where no light rule covers the text
  assert.match(run('hover:text-red-300').join('\n'), /hover:text-red-300 has no light value \(hover\)/)
  // ... but none when the resting text's light rule wins over it, as in the browser
  assert.deepEqual(run('text-zinc-400 hover:text-red-300'), [])
  // a template's fixed part pairs with each of its branches
  assert.deepEqual(classStrings('<b className={`px-2 ${on ? \'bg-zinc-700 text-white\' : \'text-zinc-400\'}`} />'),
    ['px-2', 'px-2 bg-zinc-700 text-white', 'px-2 text-zinc-400', 'bg-zinc-700 text-white', 'text-zinc-400'].filter(s => s.split(' ').some(util)))
  // a focus mark that cannot be seen
  assert.match(run('border-zinc-800 focus:border-zinc-700').join('\n'), /focus mark .* under 3:1/)
  // ... and an important one the light rules cannot override, which is how the notification field's focus border reads
  assert.deepEqual(run('border-zinc-800 focus:border-[var(--foreground)]!'), [])
  // a token stands for itself in both themes, but gold text on its own gold tint does not read in light
  assert.deepEqual(run('text-[var(--foreground)]'), [])
  assert.match(run('bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]').join('\n'), /under 4\.5:1/)
  // the Headline's tone table pairs its box with its text colour
  assert.ok(classStrings("answer: { box: 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border-x', color: 'var(--accent)' },")
    .includes('bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border-x text-[var(--accent)]'))
})

// Text on the living sky meets WCAG AA (4.5:1) on every sky, top to horizon.
// axe can't measure text over a gradient, so this reads the sky stops and the
// text colours straight out of globals.css and does the sums itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKIES } from './sky.js'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const darkPart = css.slice(css.indexOf('/* ── Living sky'), css.indexOf('/* daylight:'))
const lightPart = css.slice(css.indexOf('/* daylight:'), css.indexOf('.app-tabbar {', css.indexOf('/* daylight:')))
const NAMES = ['night', 'dawn', 'day', 'cloudy', 'rain', 'storm', 'snow', 'dusk']

const stopsOf = selector => {
  const m = css.match(new RegExp(`${selector}\\s*\\{\\s*--sky-a: (#\\w{6}); --sky-b: (#\\w{6}); --sky-c: (#\\w{6});`))
  assert.ok(m, `no sky stops for ${selector}`)
  return m.slice(1)
}
const DARK = Object.fromEntries(NAMES.map(n => [n, stopsOf(n === 'night' ? ':root' : `:root\\[data-sky="${n}"\\]`)]))
const LIGHT = {
  start: stopsOf(':root\\[data-theme="light"\\]'),
  ...Object.fromEntries(NAMES.map(n => [n, stopsOf(`:root\\[data-theme="light"\\]\\[data-sky="${n}"\\]`)])),
}

// '#rrggbb' or 'rgb(r g b / a)' → [[r, g, b], alpha]
const colour = v => {
  if (v.startsWith('#')) return [[1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)), 1]
  const [r, g, b, a = 1] = v.match(/[\d.]+/g).map(Number)
  return [[r, g, b], a]
}
const prop = (part, name) => colour(part.match(new RegExp(`${name}:\\s*([^;]+);`))[1])
const textZinc = (part, n) => {
  const v = part.match(new RegExp(`\\.text-zinc-${n} \\{ color: ([^;]+); \\}`))[1]
  return v.startsWith('var(') ? prop(part, v.slice(4, -1)) : colour(v)
}

const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a))
const lum = rgb => {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const WHITE = [255, 255, 255], INK = [15, 27, 51]

const failures = (skies, panels, texts) => {
  const out = []
  for (const [sky, stops] of Object.entries(skies)) for (const stop of stops) {
    for (const [panel, paint] of Object.entries(panels)) {
      const bg = paint(colour(stop)[0])
      for (const [name, [rgb, a]] of Object.entries(texts)) {
        const r = ratio(over(rgb, a, bg), bg)
        if (r < 4.5) out.push(`${name} on ${sky} ${stop} (${panel}): ${r.toFixed(2)}`)
      }
    }
  }
  return out
}

test('the dark skies in globals.css are the SKIES palette (widgets, share images)', () => {
  assert.deepEqual(DARK, SKIES)
})

test('dark sky: every text colour reaches 4.5:1 on every stop, even in a chip inside a card', () => {
  const texts = {
    'zinc-300': textZinc(darkPart, 300), 'zinc-400': textZinc(darkPart, 400),
    muted: prop(darkPart, '--muted'), 'zinc-600': textZinc(darkPart, 600),
    ...Object.fromEntries(['--accent', '--ok', '--warn', '--bad', '--info', '--hot'].map(t => [t, prop(darkPart, t)])),
  }
  const panels = {
    // a card (white 7.5%) holding a chip (white 6.5%) — the lightest place small text sits
    'chip in card': s => over(WHITE, 0.135, s),
    // the headline's tinted box, straight on the sky
    'headline box': s => over([255, 209, 102], 0.12, s),
  }
  assert.deepEqual(failures(DARK, panels, texts), [])
  // the sunlight badge inside a card (sources panel) carries accent text only
  const badge = { 'badge in card': s => over([255, 217, 138], 0.16, over(WHITE, 0.075, s)) }
  assert.deepEqual(failures(DARK, badge, { '--accent': texts['--accent'] }), [])
})

test('light sky: every text colour reaches 4.5:1 on the bare sky and on its glass cards', () => {
  const texts = {
    'zinc-300': textZinc(lightPart, 300), 'zinc-400': textZinc(lightPart, 400),
    muted: prop(lightPart, '--muted'), 'zinc-600': textZinc(lightPart, 600),
    // status colours sit straight on the sky too (the hero's agreement, the hiking disclaimer)
    ...Object.fromEntries(['--accent', '--accent-strong', '--ok', '--warn', '--bad', '--info', '--hot'].map(t => [t, prop(lightPart, t)])),
  }
  const panels = {
    bare: s => s,
    glass: s => over(WHITE, 0.56, s),
    'chip on glass': s => over(INK, 0.07, over(WHITE, 0.56, s)),
  }
  assert.deepEqual(failures(LIGHT, panels, texts), [])
  const coloured = texts
  const badge = { 'badge in card': s => over([35, 80, 200], 0.1, over(WHITE, 0.56, s)) }
  assert.deepEqual(failures(LIGHT, badge, { '--accent': coloured['--accent'] }), [])
})

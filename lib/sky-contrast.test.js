// Text on the page background meets WCAG AA (4.5:1) everywhere: in dark mode on the solid
// Slate and where the sun's gold glow is at its brightest, in light mode on the near-white
// sky. axe can't measure text over a gradient, so this reads the colours straight out of
// globals.css and does the sums itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const darkPart = css.slice(css.indexOf('/* ── Page background'), css.indexOf('/* daylight:'))
const lightPart = css.slice(css.indexOf('/* daylight:'), css.indexOf('.app-tabbar {', css.indexOf('/* daylight:')))

const stopsOf = selector => {
  const m = css.match(new RegExp(`${selector}\\s*\\{\\s*--sky-a: (#\\w{6}); --sky-b: (#\\w{6}); --sky-c: (#\\w{6});`))
  assert.ok(m, `no sky stops for ${selector}`)
  return m.slice(1)
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
const WHITE = [255, 255, 255], INK = [20, 28, 43]

const DARK_STOPS = stopsOf(':root')
const SLATE = colour(DARK_STOPS[0])[0]
// the glow's colour at its centre, the brightest point, for each sun position
const GLOW = Object.fromEntries(['dawn', 'day', 'dusk'].map(n => {
  const m = css.match(new RegExp(`\\[data-sky="${n}"\\] \\{ --glow: radial-gradient\\([^;]*?(rgb\\([^)]+\\))`))
  assert.ok(m, `no glow for ${n}`)
  return [n, colour(m[1])]
}))
// the grounds text can sit on in dark mode: plain Slate (night) and Slate under each glow's peak
const DARK = { night: [SLATE], ...Object.fromEntries(Object.entries(GLOW).map(([n, [rgb, a]]) => [n, [over(rgb, a, SLATE)]])) }
// the light theme has one fixed sky: near-white, whatever the weather
const LIGHT = { start: stopsOf(':root\\[data-theme="light"\\]').map(s => colour(s)[0]) }

const failures = (grounds, panels, texts) => {
  const out = []
  for (const [name, list] of Object.entries(grounds)) for (const ground of list) {
    for (const [panel, paint] of Object.entries(panels)) {
      const bg = paint(ground)
      for (const [text, [rgb, a]] of Object.entries(texts)) {
        const r = ratio(over(rgb, a, bg), bg)
        if (r < 4.5) out.push(`${text} on ${name} (${panel}): ${r.toFixed(2)}`)
      }
    }
  }
  return out
}

test('dark: one solid Slate, whatever the weather (no gradient, no weather skies)', () => {
  assert.deepEqual(DARK_STOPS, ['#0f151b', '#0f151b', '#0f151b'])
  for (const weather of ['rain', 'storm', 'snow', 'cloudy']) assert.equal(css.includes(`[data-sky="${weather}"]`), false, weather)
})

test('dark: the glow is gold, only in dark mode, and Slate has no purple in it', () => {
  for (const [n, [[r, g, b]]] of Object.entries(GLOW)) assert.ok(r > g && g > b, `${n} glow is not gold`)
  assert.ok(SLATE[0] < SLATE[1] && SLATE[1] < SLATE[2], 'Slate leans red (purple)')
  assert.equal(/:root\[data-theme="light"\][^{]*\{ --glow:/.test(css), false)
})

test('dark: every text colour reaches 4.5:1 on Slate and at the glow\'s brightest, bare, in a chip inside a card and in the headline box', () => {
  const texts = {
    foreground: prop(darkPart, '--foreground'),
    'zinc-300': textZinc(darkPart, 300), 'zinc-400': textZinc(darkPart, 400),
    muted: prop(darkPart, '--muted'), 'zinc-600': textZinc(darkPart, 600),
    ...Object.fromEntries(['--accent', '--ok', '--warn', '--bad', '--info', '--hot', '--lifr'].map(t => [t, prop(darkPart, t)])),
  }
  const [, card] = prop(darkPart, '--glass')
  const panels = {
    // the header and the hero sit straight on the page, under the glow
    bare: s => s,
    // a card holding a chip (white 6.5%): the lightest place small text sits
    'chip in card': s => over(WHITE, 0.065, over(WHITE, card, s)),
    // the current hour's pill in the hour strip (--surface-2) inside the chart card
    'hour pill in card': s => over(WHITE, prop(darkPart, '--surface-2')[1], over(WHITE, card, s)),
    // the headline's tinted box, straight on the page
    'headline box': s => over([255, 209, 102], 0.12, s),
  }
  assert.deepEqual(failures(DARK, panels, texts), [])
  // the sunlight badge inside a card (sources panel) carries accent text only
  const badge = { 'badge in card': s => over([255, 217, 138], 0.16, over(WHITE, card, s)) }
  assert.deepEqual(failures(DARK, badge, { '--accent': texts['--accent'] }), [])
})

test('dark: the buttons\' gold text and icons read on their surface, resting and hovered, under any glow', () => {
  const [accent] = prop(darkPart, '--accent')
  for (const name of ['--surface-2', '--surface-3']) {
    const [rgb, a] = prop(darkPart, name)
    for (const [ground, [g]] of Object.entries(DARK)) assert.ok(ratio(accent, over(rgb, a, g)) >= 4.5, `${name} on ${ground}`)
  }
})

test('light sky: one fixed sky, whatever the weather', () => {
  assert.equal(css.includes(':root[data-theme="light"][data-sky='), false)
})

test('light sky: every text colour reaches 4.5:1 on the bare sky, on white cards and on the chips inside them', () => {
  const texts = {
    'zinc-300': textZinc(lightPart, 300), 'zinc-400': textZinc(lightPart, 400),
    muted: prop(lightPart, '--muted'), 'zinc-600': textZinc(lightPart, 600),
    // status colours sit straight on the sky too (the hero's agreement, the hiking disclaimer)
    ...Object.fromEntries(['--accent', '--accent-strong', '--ok', '--warn', '--bad', '--info', '--hot', '--lifr'].map(t => [t, prop(lightPart, t)])),
  }
  const panels = {
    bare: s => s,
    card: () => WHITE,
    'chip on card': () => over(INK, 0.06, WHITE),
  }
  assert.deepEqual(failures(LIGHT, panels, texts), [])
})

test('light sky: the filled controls keep their text readable, resting and hovered', () => {
  const [onFill] = prop(lightPart, '--on-fill')
  for (const name of ['--fill', '--fill-hover']) assert.ok(ratio(onFill, prop(lightPart, name)[0]) >= 4.5, name)
})

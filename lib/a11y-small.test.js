// Two accessibility misses from the UX review (owner: before launch). Q2: the "Condition" field of "How is the
// weather where you are?" had no name for screen readers (its label was not tied to it); the temperature field
// the same. Y3: in the light theme the error red on its pink box was 4.23:1, under the 4.5:1 line.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')

test('Q2: each label of the feedback form names its field', async () => {
  const { default: FeedbackPanel } = await import('../app/components/outlook/FeedbackPanel.jsx')
  const html = render(h(FeedbackPanel, { lang: 'en', unit: 'C', city: 'Vienna', data: { lat: 48.2, lon: 16.37, sources: [] } }))
  for (const tag of ['input', 'select']) {
    const id = html.match(new RegExp(`<${tag}[^>]*id="([^"]+)"`))?.[1]
    assert.ok(id, `${tag} has an id`)
    assert.match(html, new RegExp(`<label[^>]*for="${id.replace(/[^\w-]/g, c => `\${c}`)}"`), `a label for the ${tag}`)
  }
})

// the WCAG contrast of two #rrggbb colours
const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// source-match-ok: the light theme's tokens are read from the style sheet to compute their contrast
test('Y3: the light theme\'s error red passes 4.5:1 on its pink box', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  const light = css.match(/--ok: #117948; --warn: #b24600; --bad: (#[0-9a-f]{6});/)
  assert.ok(light, 'the light tokens line')
  const pink = css.match(/\.bg-red-500\\\/20\s*\{ background-color: (#[0-9a-f]{6}); \}/)[1]
  assert.ok(ratio(light[1], pink) >= 4.5, `${light[1]} on ${pink}: ${ratio(light[1], pink).toFixed(2)}`)
})

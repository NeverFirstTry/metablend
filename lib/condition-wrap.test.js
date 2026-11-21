// The weather word beside the big temperature was cut off with an ellipsis at 320 px in French, Spanish,
// Italian, Polish and Portuguese ("Partiellement nuageux" lost up to 62 px in the app; Fable's layout recording
// of 2026-11-21). A long word now wraps onto a second line instead of losing its end.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: NowLine } = await import('../app/components/outlook/NowLine.jsx')

test('the weather word is never cut off', () => {
  const data = { consensus: { temp: 10, feelsLike: 8, confidencePct: 86, rainPct: 6 }, sources: [{ apiId: 'open-meteo', condition: 'Partly cloudy', temp: 10 }], lon: 16.37 }
  const html = render(h(NowLine, { data, unit: 'C', lang: 'fr', showT: x => x }))
  const word = html.match(/<span[^>]*>(Partiellement nuageux|[^<]*nuageux[^<]*)<\/span>/)
  assert.ok(word, 'the word is on the line')
  const cls = word[0].match(/class="([^"]*)"/)?.[1] ?? ''
  assert.doesNotMatch(cls, /\btruncate\b/)
  assert.match(cls, /\bmin-w-0\b/)
})

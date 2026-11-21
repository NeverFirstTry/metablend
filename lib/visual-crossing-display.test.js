// Visual Crossing's terms (docs/source-licences.md, pages read on 2026-11-20): its values may be shown when
// the attribution stands near the weather data, and its raw data may not be handed on. So the public
// forecast answer carries, of Visual Crossing, only the temperature the Sources panel lists; the panel shows
// it with the credit right under the list, in their wording and linked; and the landing page's example,
// which has no credit beside it, keeps the name only.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: SourcesPanel } = await import('../app/components/outlook/SourcesPanel.jsx')
const { publicSources } = await import('./sources.js')
const { exampleFrom } = await import('./landing.js')

const vienna = JSON.parse(readFileSync(new URL('./__fixtures__/forecast-vienna.json', import.meta.url), 'utf8'))
const others = vienna.sources.filter(s => s.apiId !== 'visual-crossing')
const vc = { apiId: 'visual-crossing', displayName: 'Visual Crossing', temp: 3.4, feelsLike: 1, rainPct: 10, rainIsProb: true, windKmh: 9, condition: 'Clear', responseMs: 70 }
const panel = (sources, lang = 'en') => render(h(SourcesPanel, { data: { ...vienna, sources }, unit: 'C', lang }))

test('the public answer: of Visual Crossing the name, the timing and the temperature, nothing else', () => {
  assert.deepEqual(publicSources([vc])[0], { apiId: 'visual-crossing', displayName: 'Visual Crossing', responseMs: 70, temp: 3.4 })
  assert.deepEqual(publicSources([{ apiId: 'visual-crossing', displayName: 'Visual Crossing', down: true, responseMs: 5000 }])[0], { apiId: 'visual-crossing', displayName: 'Visual Crossing', responseMs: 5000, down: true })
  const icon = { apiId: 'icon', displayName: 'DWD ICON', temp: 4, windKmh: 3, condition: 'Clear' }
  assert.deepEqual(publicSources([icon])[0], icon, 'every other source passes whole')
})

test('the Sources panel: its row shows the temperature, and the credit stands under the list, in their words and linked', () => {
  for (const lang of ['en', 'de']) {
    const html = panel([...others, ...publicSources([vc])], lang)
    const row = html.split('</tr>').find(r => r.includes('Visual Crossing')) ?? ''
    assert.match(row, /3°/, `${lang}: the temperature`)
    assert.doesNotMatch(row, /colspan/i, `${lang}: no line in place of the values`)
    const credit = html.indexOf('<a href="https://www.visualcrossing.com/"')
    assert.ok(credit > html.indexOf('</table>'), `${lang}: the credit comes after the list, in the same panel`)
    assert.match(html.slice(credit), /^<a href="https:\/\/www\.visualcrossing\.com\/"[^>]*>Weather data provided by Visual Crossing Weather<\/a>/, `${lang}: their wording, linked`)
  }
})

test('the landing page example has no credit beside it: Visual Crossing by name only', () => {
  const ex = exampleFrom({ consensus: { temp: 3, confidencePct: 80 }, sources: [...publicSources([vc]), { apiId: 'open-meteo', displayName: 'Open-Meteo', temp: 4, condition: 'Clear' }] })
  assert.deepEqual(ex.sources, [{ apiId: 'visual-crossing', displayName: 'Visual Crossing' }, { apiId: 'open-meteo', displayName: 'Open-Meteo', temp: 4 }])
})

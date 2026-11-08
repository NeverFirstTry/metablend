// WeatherAPI.com's terms ask that its end-user disclaimer stands where the data is shown:
// the Sources panel carries one short line, in the visitor's language, linked to the full
// notice on /terms, whenever WeatherAPI's data is in the blend, and never otherwise.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: SourcesPanel } = await import('../app/components/outlook/SourcesPanel.jsx')
const { LANGUAGES, t } = await import('./i18n.js')

const vienna = JSON.parse(readFileSync(new URL('./__fixtures__/forecast-vienna.json', import.meta.url), 'utf8'))
const withSources = sources => ({ ...vienna, sources })
const others = vienna.sources.filter(s => s.apiId !== 'weatherapi')
const weatherapi = { apiId: 'weatherapi', displayName: 'WeatherAPI', temp: 5, feelsLike: 4, rainPct: null, windKmh: 7, condition: 'Clear', responseMs: 180 }
const panel = (sources, lang = 'en') => render(h(SourcesPanel, { data: withSources(sources), unit: 'C', lang }))

test('the Sources panel: the WeatherAPI.com line, linked to the notice on /terms, only while its data is in the blend', () => {
  const shown = panel([...others, weatherapi])
  assert.ok(shown.includes('href="/terms#weatherapi-notice"'), 'links to the notice')
  assert.ok(shown.includes(t('en', 'weatherApiNote')), 'the English line')
  assert.ok(panel([...others, weatherapi], 'de').includes(t('de', 'weatherApiNote')), 'the German line')
  assert.equal(panel(others).includes('weatherapi-notice'), false, 'no WeatherAPI, no line')
  assert.equal(panel([...others, { ...weatherapi, down: true }]).includes('weatherapi-notice'), false, 'WeatherAPI down, no line')
})

test('the line names WeatherAPI.com in all 13 languages', () => {
  for (const { code } of LANGUAGES) assert.match(t(code, 'weatherApiNote'), /WeatherAPI\.com/, code)
})

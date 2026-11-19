import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DATA_CREDITS, RADAR_CREDIT } from './credits.js'

// The providers set these words; a rewording would break their terms.
test('credits: each provider is named in the words its terms ask for, with a link', () => {
  const said = new Map(DATA_CREDITS)
  for (const words of ['Weather data by Open-Meteo.com', 'Weather data © OpenWeather', 'Powered by WeatherAPI.com', 'Weather data provided by Visual Crossing Weather', 'Data from MET Norway']) {
    assert.match(said.get(words) ?? '', /^https:\/\//, words)
  }
  assert.deepEqual(RADAR_CREDIT, ['Weather data by RainViewer', 'https://www.rainviewer.com/'])
})

// CC BY 4.0 asks for the licence and for a note that the data were changed. They stand on /terms, so the credit
// line leads there wherever it is shown: under the Sources panel, in the footer and on the app's More screen.
test('credits: the line leads to the list with the licences and the note on changes, in its short and its full form', async () => {
  const { createElement: h } = await import('react')
  const { renderToStaticMarkup: render } = await import('react-dom/server')
  const { default: Credits } = await import('../app/components/Credits.jsx')
  for (const full of [false, true]) {
    const html = render(h(Credits, { lang: 'en', full }))
    assert.match(html, /<a[^>]* href="\/terms#sources"[^>]*>Sources and licences<\/a>/, full ? 'full' : 'short')
    assert.ok(html.indexOf('ČHMÚ (CHMI)') > 0 && html.indexOf('ČHMÚ (CHMI)') < html.indexOf('Sources and licences'), 'after the providers')
  }
})

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

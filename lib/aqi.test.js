import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aqiText } from './i18n.js'

// Open-Meteo's european_aqi in its EEA bands. 42 was "Unhealthy for Sensitive Groups" (US AQI words).
test('aqiText: each European AQI band at its edges', () => {
  const cases = [[0, 'Good'], [20, 'Good'], [21, 'Fair'], [40, 'Fair'], [41, 'Moderate'], [42, 'Moderate'], [60, 'Moderate'],
    [61, 'Poor'], [80, 'Poor'], [81, 'Very poor'], [100, 'Very poor'], [101, 'Extremely poor'], [250, 'Extremely poor']]
  for (const [v, word] of cases) assert.equal(aqiText('en', v), word, String(v))
  assert.equal(aqiText('en', null), '–')
})

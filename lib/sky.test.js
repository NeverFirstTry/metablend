import { test } from 'node:test'
import assert from 'node:assert/strict'
import { skyFor, SKIES, isDark, nightIcon } from './sky.js'

const SUN = { sunrise: '06:50', sunset: '18:40' }
const at = (hhmm, code) => skyFor({ code, nowLocal: `2026-10-01T${hhmm}`, sun: SUN })

test('skyFor — time of day for clear and cloudy skies', () => {
  assert.equal(at('03:00', 0), 'night')
  assert.equal(at('06:30', 1), 'dawn')
  assert.equal(at('07:30', 0), 'dawn')
  assert.equal(at('12:00', 0), 'day')
  assert.equal(at('12:00', 3), 'cloudy')
  assert.equal(at('18:00', 2), 'dusk')
  assert.equal(at('19:10', 0), 'dusk')
  assert.equal(at('21:00', 3), 'night')
})

test('skyFor — weather wins over the hour: rain, snow, storm, fog', () => {
  assert.equal(at('12:00', 63), 'rain')
  assert.equal(at('02:00', 81), 'rain')
  assert.equal(at('12:00', 55), 'rain') // drizzle
  assert.equal(at('07:00', 73), 'snow')
  assert.equal(at('16:00', 95), 'storm')
  assert.equal(at('12:00', 45), 'cloudy') // fog
})

test('skyFor — unknown weather or sun times still give a sky', () => {
  assert.equal(skyFor({ code: null, nowLocal: '2026-10-01T13:00', sun: null }), 'day')
  assert.equal(skyFor({ code: 0, nowLocal: '2026-10-01T23:30', sun: { sunrise: null, sunset: null } }), 'night')
  assert.equal(skyFor({}), 'night')
  assert.ok(Object.values(SKIES).every(s => s.length === 3))
})

test('isDark — before sunrise and from sunset on; unknown without sun times', () => {
  assert.equal(isDark('06:49', SUN), true)
  assert.equal(isDark('06:50', SUN), false)
  assert.equal(isDark('18:39', SUN), false)
  assert.equal(isDark('18:40', SUN), true)
  assert.equal(isDark('12:00', null), null)
  assert.equal(isDark(undefined, SUN), null)
})

test('nightIcon — sun icons turn to the moon, the rest stays', () => {
  assert.equal(nightIcon('☀️'), '🌙')
  assert.equal(nightIcon('🌤'), '🌙')
  assert.equal(nightIcon('⛅'), '☁️')
  assert.equal(nightIcon('🌧'), '🌧')
  assert.equal(nightIcon(null), null)
})

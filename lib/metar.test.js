import test from 'node:test'
import assert from 'node:assert/strict'
import { sigWeather, parseRvr, visCategory, ceilingCategory, tafWindshear } from './metar.js'

test('sigWeather: thunderstorm variants', () => {
  assert.equal(sigWeather('TSRA')[0].label, 'Thunderstorm')
  assert.equal(sigWeather('TSRA')[0].severity, 'severe')
  assert.equal(sigWeather('-TSRA')[0].label, 'Thunderstorm') // intensity of the rain, not the storm
  assert.equal(sigWeather('+TSRA')[0].label, 'Heavy thunderstorm')
  assert.deepEqual(sigWeather('VCTS')[0], { label: 'Thunderstorm (vicinity)', severity: 'severe', vicinity: true })
})

test('sigWeather: freezing precipitation', () => {
  assert.equal(sigWeather('FZRA')[0].label, 'Freezing rain')
  assert.equal(sigWeather('-FZDZ')[0].label, 'Freezing drizzle')
  assert.equal(sigWeather('+FZRA')[0].label, 'Heavy freezing rain')
  assert.equal(sigWeather('FZFG')[0].label, 'Freezing fog')
  assert.equal(sigWeather('FZFG')[0].severity, 'caution')
})

test('sigWeather: hail, squall, funnel, dust', () => {
  assert.equal(sigWeather('GR')[0].label, 'Hail')
  assert.equal(sigWeather('SHGS')[0].label, 'Small hail / snow pellets')
  assert.equal(sigWeather('PL')[0].label, 'Ice pellets')
  assert.equal(sigWeather('SQ')[0].label, 'Squall')
  assert.equal(sigWeather('FC')[0].label, 'Funnel cloud')
  assert.equal(sigWeather('+FC')[0].label, 'Tornado / waterspout')
  assert.equal(sigWeather('SS')[0].label, 'Sandstorm')
  assert.equal(sigWeather('DS')[0].label, 'Duststorm')
  assert.equal(sigWeather('BLSN')[0].label, 'Blowing snow')
})

test('sigWeather: compound tokens flag every phenomenon', () => {
  const labels = sigWeather('TSGR').map(f => f.label)
  assert.ok(labels.includes('Thunderstorm') && labels.includes('Hail'))
  // severe sorts before caution
  const mixed = sigWeather('PL TSRA')
  assert.equal(mixed[0].severity, 'severe')
})

test('sigWeather: benign weather and junk stay silent', () => {
  assert.deepEqual(sigWeather('-SHRA'), [])
  assert.deepEqual(sigWeather('HZ'), [])
  assert.deepEqual(sigWeather('-RA BR'), [])
  assert.deepEqual(sigWeather('FG'), [])
  assert.deepEqual(sigWeather(''), [])
  assert.deepEqual(sigWeather(null), [])
  assert.deepEqual(sigWeather(undefined), [])
})

test('parseRvr: metric, prefixes, variation, trend', () => {
  assert.deepEqual(parseRvr('METAR X 121420Z R24L/P2000N 9999'), [{ rwy: '24L', text: '>2000 m' }])
  assert.deepEqual(parseRvr('R06/0550U'), [{ rwy: '06', text: '550 m improving' }])
  assert.deepEqual(parseRvr('R09/0800V1200D'), [{ rwy: '09', text: '800–1200 m worsening' }])
  assert.deepEqual(parseRvr('R31C/M0300'), [{ rwy: '31C', text: '<300 m' }])
})

test('parseRvr: US feet groups', () => {
  assert.deepEqual(parseRvr('R04R/2000FT'), [{ rwy: '04R', text: '2000 ft' }])
  assert.deepEqual(parseRvr('R22/1800V2400FT'), [{ rwy: '22', text: '1800–2400 ft' }])
})

test('parseRvr: multiple runways, none, junk', () => {
  assert.equal(parseRvr('R06L/1200N R24R/P2000').length, 2)
  assert.deepEqual(parseRvr('METAR LOWI 121420Z 08010KT 9999 FEW080 30/11 Q1019'), [])
  assert.deepEqual(parseRvr(null), [])
})

test('per-value categories follow the NWS thresholds', () => {
  assert.equal(visCategory(0.9), 'LIFR')
  assert.equal(visCategory(1), 'IFR')
  assert.equal(visCategory(2.9), 'IFR')
  assert.equal(visCategory(3), 'MVFR')
  assert.equal(visCategory(5), 'MVFR')
  assert.equal(visCategory(5.1), 'VFR')
  assert.equal(visCategory(null), null)
  assert.equal(ceilingCategory(499), 'LIFR')
  assert.equal(ceilingCategory(500), 'IFR')
  assert.equal(ceilingCategory(999), 'IFR')
  assert.equal(ceilingCategory(1000), 'MVFR')
  assert.equal(ceilingCategory(3000), 'MVFR')
  assert.equal(ceilingCategory(3001), 'VFR')
  assert.equal(ceilingCategory(null), null)
})

test('tafWindshear reads either field spelling, null when absent', () => {
  assert.equal(tafWindshear({ wshearHgt: 20, wshearDir: 180, wshearSpd: 40 }).label, 'Windshear 20 ft · 180°/40 kt')
  assert.equal(tafWindshear({ wsHgt: 10 }).label, 'Windshear 10 ft')
  assert.equal(tafWindshear({}), null)
  assert.equal(tafWindshear(null), null)
})

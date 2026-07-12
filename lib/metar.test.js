import test from 'node:test'
import assert from 'node:assert/strict'
import { sigWeather, parseRvr, visCategory, ceilingCategory, tafWindshear, skyInfo, reportFlags, activeTafPeriod, tafDivergence } from './metar.js'

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

test('skyInfo: normal ceilings', () => {
  assert.deepEqual(skyInfo([{ cover: 'FEW', base: 2000 }, { cover: 'BKN', base: 1200 }, { cover: 'OVC', base: 3000 }]),
    { known: true, ceilingFt: 1200, obscured: false, unknownBase: false })
  assert.deepEqual(skyInfo([{ cover: 'VV', base: 400 }]),
    { known: true, ceilingFt: 400, obscured: false, unknownBase: false })
})

test('skyInfo: clear-sky codes give no ceiling but ARE known', () => {
  for (const cover of ['NSC', 'NCD', 'SKC', 'CLR']) {
    assert.deepEqual(skyInfo([{ cover }]), { known: true, ceilingFt: null, obscured: false, unknownBase: false }, cover)
  }
  assert.deepEqual(skyInfo([]), { known: true, ceilingFt: null, obscured: false, unknownBase: false })
})

test('skyInfo: unreported heights refuse to read as "no ceiling"', () => {
  // VV/// — obscured, vertical visibility not measured
  const vv = skyInfo([{ cover: 'VV', base: null }])
  assert.equal(vv.obscured, true)
  assert.equal(vv.unknownBase, true)
  assert.equal(vv.ceilingFt, null)
  const ovx = skyInfo([{ cover: 'OVX' }])
  assert.equal(ovx.obscured, true)
  // BKN/// — broken layer, height not reported: not obscured, but unknown
  const bkn = skyInfo([{ cover: 'BKN', base: null }])
  assert.equal(bkn.obscured, false)
  assert.equal(bkn.unknownBase, true)
  // a measured lower ceiling still wins even next to an unknown layer
  const mixed = skyInfo([{ cover: 'BKN', base: null }, { cover: 'OVC', base: 800 }])
  assert.equal(mixed.ceilingFt, 800)
  assert.equal(mixed.unknownBase, true)
})

test('skyInfo: missing sky data is not "known clear"', () => {
  assert.equal(skyInfo(null).known, false)
  assert.equal(skyInfo(undefined).known, false)
})

test('reportFlags: AUTO, COR, CAVOK from raw text', () => {
  assert.deepEqual(reportFlags('METAR LOWI 121920Z AUTO 09004KT 9999 NCD 24/10 Q1021'), ['AUTO'])
  assert.deepEqual(reportFlags('METAR KTPA 121453Z COR VRB04KT 10SM FEW030'), ['COR'])
  assert.deepEqual(reportFlags('METAR LOWW 121920Z 34009KT CAVOK 25/12 Q1018'), ['CAVOK'])
  assert.deepEqual(reportFlags('METAR EGLL 121920Z 07014KT 9999 NCD 25/05 Q1024'), [])
  assert.deepEqual(reportFlags(null), [])
})

test('activeTafPeriod: later base lines supersede, TEMPO kept separate', () => {
  const fcsts = [
    { timeFrom: 0, timeTo: 100, fcstChange: null, id: 'initial' },
    { timeFrom: 50, timeTo: 100, fcstChange: 'FM', id: 'fm' },
    { timeFrom: 40, timeTo: 80, fcstChange: 'TEMPO', id: 'tempo' },
    { timeFrom: 60, timeTo: 90, fcstChange: 'PROB30 TEMPO', id: 'prob' },
  ]
  const at60 = activeTafPeriod(fcsts, 60)
  assert.equal(at60.base.id, 'fm')        // FM supersedes the initial line
  assert.equal(at60.tempo.id, 'tempo')    // first matching overlay
  const at10 = activeTafPeriod(fcsts, 10)
  assert.equal(at10.base.id, 'initial')
  assert.equal(at10.tempo, null)
  assert.deepEqual(activeTafPeriod(fcsts, 200), { base: null, tempo: null })
  assert.deepEqual(activeTafPeriod(null, 60), { base: null, tempo: null })
})

test('tafDivergence: category differences with direction', () => {
  const d = tafDivergence(
    { visCat: 'IFR', ceilCat: 'IFR', sig: [] },
    { visCat: 'VFR', ceilCat: 'MVFR', sig: [] },
  )
  assert.equal(d.length, 2)
  assert.deepEqual(d[0], { field: 'ceiling', metar: 'IFR', taf: 'MVFR', tafOptimistic: true })
  assert.deepEqual(d[1], { field: 'visibility', metar: 'IFR', taf: 'VFR', tafOptimistic: true })
  // reality better than forecast
  const better = tafDivergence(
    { visCat: 'VFR', ceilCat: 'VFR', sig: [] },
    { visCat: 'MVFR', ceilCat: 'VFR', sig: [] },
  )
  assert.equal(better[0].tafOptimistic, false)
})

test('tafDivergence: unknown categories never count as divergence', () => {
  assert.deepEqual(tafDivergence({ visCat: 'IFR', ceilCat: null, sig: [] }, { visCat: null, ceilCat: 'VFR', sig: [] }), [])
})

test('tafDivergence: weather present on one side only', () => {
  const d = tafDivergence(
    { visCat: 'VFR', ceilCat: 'VFR', sig: ['Thunderstorm'] },
    { visCat: 'VFR', ceilCat: 'VFR', sig: [] },
  )
  assert.deepEqual(d, [{ field: 'weather', metar: 'Thunderstorm', taf: null, tafOptimistic: true }])
  const d2 = tafDivergence(
    { visCat: 'VFR', ceilCat: 'VFR', sig: [] },
    { visCat: 'VFR', ceilCat: 'VFR', sig: ['Freezing rain'] },
  )
  assert.deepEqual(d2, [{ field: 'weather', metar: null, taf: 'Freezing rain', tafOptimistic: false }])
  // identical weather on both sides: aligned
  assert.deepEqual(tafDivergence(
    { visCat: 'VFR', ceilCat: 'VFR', sig: ['Thunderstorm'] },
    { visCat: 'VFR', ceilCat: 'VFR', sig: ['Thunderstorm'] },
  ), [])
})

test('tafWindshear reads either field spelling, null when absent', () => {
  assert.equal(tafWindshear({ wshearHgt: 20, wshearDir: 180, wshearSpd: 40 }).label, 'Windshear 20 ft · 180°/40 kt')
  assert.equal(tafWindshear({ wsHgt: 10 }).label, 'Windshear 10 ft')
  assert.equal(tafWindshear({}), null)
  assert.equal(tafWindshear(null), null)
})

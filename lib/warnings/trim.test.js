import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { trimFeed } from './trim.js'
import { parseFeed } from './parse.js'

const fixture = name => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8'))
const sentOf = json => Math.min(...json.warnings.map(w => Date.parse(w.alert.sent)))

const alert = (id, extra = {}, expires = '2026-10-08T20:00:00+02:00') => ({
  alert: {
    identifier: id, msgType: 'Alert', status: 'Actual', sender: 'x@example.org', sent: '2026-10-08T06:00:00+02:00', ...extra,
    info: [{
      language: 'de-DE', event: 'GEWITTER', headline: 'Warnung', description: 'Gewitter.', instruction: '',
      onset: '2026-10-08T14:00:00+02:00', expires,
      parameter: [{ valueName: 'awareness_level', value: '3; orange; Severe' }, { valueName: 'awareness_type', value: '3; Thunderstorm' }],
      area: [{ areaDesc: 'Kreis X', geocode: [{ valueName: 'EMMA_ID', value: 'DE103' }] }],
    }],
  },
})
const NOW = Date.parse('2026-10-08T12:00:00+02:00')

test('trimFeed — warnings still in force stay whole, the rest shrink to what replacement and dedupe read', () => {
  const t = trimFeed({ warnings: [alert('on'), alert('old', {}, '2026-10-07T20:00:00+02:00')] }, NOW - 3600e3)
  assert.equal(t.warnings[0].alert.info.length, 1)
  assert.deepEqual(t.warnings[1], { alert: { identifier: 'old', msgType: 'Alert', status: 'Actual', sent: '2026-10-08T06:00:00+02:00' } })
  assert.deepEqual(trimFeed(null, NOW), { warnings: [] })
})

test('trimFeed — the parser gives exactly the same warnings for the trimmed feed (real German and Spanish feeds)', () => {
  for (const [name, cc] of [['feed-germany', 'DE'], ['feed-spain', 'ES']]) {
    const json = fixture(name)
    for (const now of [sentOf(json), sentOf(json) + 6 * 3600e3, sentOf(json) + 30 * 3600e3]) {
      const trimmed = trimFeed(json, now - 3600e3) // trimmed an hour before the parse runs
      assert.deepEqual(parseFeed(trimmed, cc, now), parseFeed(json, cc, now), `${name} @ ${new Date(now).toISOString()}`)
      assert.ok(JSON.stringify(trimmed).length <= JSON.stringify(json).length)
    }
  }
})

test('trimFeed — green (level 1) notices, cancels and test messages shrink too, whatever their dates', () => {
  const green = alert('g'); green.alert.info[0].parameter[0].value = '1; green; Minor'
  const t = trimFeed({ warnings: [green, alert('c', { msgType: 'Cancel' }), alert('x', { status: 'Exercise' }), alert('o')] }, NOW - 3600e3)
  assert.deepEqual(t.warnings.map(w => !!w.alert.info), [false, false, false, true])
  assert.deepEqual(t.warnings[1].alert, { identifier: 'c', msgType: 'Cancel', status: 'Actual', sent: '2026-10-08T06:00:00+02:00' })
})

test('trimFeed — an expired Update that shortened a warning still replaces it; duplicate ids still resolve the same', () => {
  const ref = id => `x@example.org,${id},2026-10-08T05:00:00+02:00`
  const feed = { warnings: [
    alert('a', {}, '2026-10-09T20:00:00+02:00'), // the original: valid until tomorrow…
    alert('b', { msgType: 'Update', references: ref('a') }, '2026-10-08T09:00:00+02:00'), // …shortened to this morning: over
    alert('d', { sent: '2026-10-08T06:00:00+02:00' }), alert('d', { sent: '2026-10-08T07:00:00+02:00' }, '2026-10-07T20:00:00+02:00'), // later copy expired
  ] }
  const trimmed = trimFeed(feed, NOW - 3600e3)
  assert.deepEqual(parseFeed(trimmed, 'DE', NOW), parseFeed(feed, 'DE', NOW))
  assert.deepEqual(parseFeed(feed, 'DE', NOW), []) // nothing is in force here, before or after trimming
})

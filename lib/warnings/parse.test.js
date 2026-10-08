import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseFeed, WARNING_TYPES } from './parse.js'
import { FEEDS, feedUrl } from './feeds.js'

const fixture = name => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8'))
const sentOf = json => Math.min(...json.warnings.map(w => Date.parse(w.alert.sent)))

test('parseFeed — real German and Spanish warnings', () => {
  for (const [name, cc] of [['feed-germany', 'DE'], ['feed-spain', 'ES']]) {
    const json = fixture(name)
    const list = parseFeed(json, cc, sentOf(json))
    assert.ok(list.length > 0, name)
    for (const w of list) {
      assert.equal(w.country, cc)
      assert.ok(w.regions.length > 0 && w.regions.every(r => r.startsWith(cc)), w.id)
      assert.ok([2, 3, 4].includes(w.level), w.id)
      assert.ok(WARNING_TYPES.includes(w.type), `${w.id} ${w.type}`)
      assert.ok(Date.parse(w.expires) > sentOf(json))
      assert.ok(Object.keys(w.texts).length > 0)
      for (const tx of Object.values(w.texts)) assert.equal(typeof tx.headline, 'string')
    }
  }
})

const alert = (id, extra = {}, info = {}) => ({
  alert: {
    identifier: id, msgType: 'Alert', status: 'Actual', sender: 'x@example.org', sent: '2026-10-08T06:00:00+02:00', ...extra,
    info: [{
      language: 'de-DE', event: 'GEWITTER', headline: 'Amtliche WARNUNG vor GEWITTER', description: 'Es treten Gewitter auf.', instruction: '',
      onset: '2026-10-08T14:00:00+02:00', expires: '2026-10-08T20:00:00+02:00', senderName: 'Deutscher Wetterdienst', web: 'https://dwd.de',
      parameter: [{ valueName: 'awareness_level', value: '3; orange; Severe' }, { valueName: 'awareness_type', value: '3; Thunderstorm' }],
      area: [{ areaDesc: 'Kreis X', geocode: [{ valueName: 'EMMA_ID', value: 'DE103' }, { valueName: 'WARNCELLID', value: '9' }] }],
      ...info,
    }, { language: 'en-GB', event: 'THUNDERSTORMS', headline: 'Official WARNING of THUNDERSTORMS', description: 'Thunderstorms.', instruction: 'Stay inside.', onset: '2026-10-08T14:00:00+02:00', expires: '2026-10-08T20:00:00+02:00', parameter: [], area: [] }],
  },
})
const NOW = Date.parse('2026-10-08T08:00:00+02:00')

test('parseFeed — one record per alert, with its level, type, regions and texts per language', () => {
  const [w] = parseFeed({ warnings: [alert('a')] }, 'DE', NOW)
  assert.equal(w.id, 'a')
  assert.equal(w.level, 3)
  assert.equal(w.type, 'thunderstorm')
  assert.deepEqual(w.regions, ['DE103'])
  assert.equal(w.onset, '2026-10-08T14:00:00+02:00')
  assert.equal(w.sender, 'Deutscher Wetterdienst')
  assert.deepEqual(Object.keys(w.texts).sort(), ['de', 'en'])
  assert.equal(w.texts.en.instruction, 'Stay inside.')
})

test('parseFeed — expired, green, test-only and area-less alerts are dropped', () => {
  assert.deepEqual(parseFeed({ warnings: [alert('a')] }, 'DE', Date.parse('2026-10-08T21:00:00+02:00')), [])
  assert.deepEqual(parseFeed({ warnings: [alert('g', {}, { parameter: [{ valueName: 'awareness_level', value: '1; green; Minor' }] })] }, 'DE', NOW), [])
  assert.deepEqual(parseFeed({ warnings: [alert('t', { status: 'Test' })] }, 'DE', NOW), [])
  assert.deepEqual(parseFeed({ warnings: [alert('n', {}, { area: [{ areaDesc: 'X', geocode: [] }] })] }, 'DE', NOW), [])
  assert.deepEqual(parseFeed(null, 'DE', NOW), [])
})

test('parseFeed — Update and Cancel replace what they reference', () => {
  const update = alert('b', { msgType: 'Update', references: 'x@example.org,a,2026-10-08T06:00:00+02:00' }, { parameter: [{ valueName: 'awareness_level', value: '4; red; Extreme' }, { valueName: 'awareness_type', value: '3; Thunderstorm' }] })
  const list = parseFeed({ warnings: [alert('a'), update] }, 'DE', NOW)
  assert.deepEqual(list.map(w => [w.id, w.level]), [['b', 4]])
  const cancel = alert('c', { msgType: 'Cancel', references: 'x@example.org,b,2026-10-08T07:00:00+02:00' })
  assert.deepEqual(parseFeed({ warnings: [alert('a'), update, cancel] }, 'DE', NOW), [])
})

test('parseFeed — an unknown awareness type is kept as "other"', () => {
  const [w] = parseFeed({ warnings: [alert('o', {}, { parameter: [{ valueName: 'awareness_level', value: '2; yellow; Moderate' }, { valueName: 'awareness_type', value: '99; Something' }] })] }, 'DE', NOW)
  assert.equal(w.type, 'other')
})

test('FEEDS — 35 countries, each with outlines in the region map', () => {
  const data = JSON.parse(fs.readFileSync(new URL('./regions.json', import.meta.url), 'utf8'))
  const prefixes = new Set(data.regions.map(r => r.c.slice(0, 2)))
  assert.equal(FEEDS.length, 35)
  for (const [slug, cc] of FEEDS) assert.ok(prefixes.has(cc), `${slug} ${cc}`)
  assert.equal(feedUrl('austria'), 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-austria')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAppWidgetQuery, weatherPayload, hikePayload, skyForIcon } from './app-widget.js'
import { t } from './i18n.js'

const sp = q => new URLSearchParams(q)
const weekday = (date, lang) => new Date(date).toLocaleDateString(lang, { weekday: 'short', timeZone: 'UTC' })

test('parseAppWidgetQuery — weather: city (any script), language and unit', () => {
  assert.deepEqual(parseAppWidgetQuery(sp('city=Sankt%20P%C3%B6lten&lang=de&unit=F')), { kind: 'weather', city: 'Sankt Pölten', lang: 'de', unit: 'F' })
  assert.deepEqual(parseAppWidgetQuery(sp("city=L'Aquila")), { kind: 'weather', city: "L'Aquila", lang: 'en', unit: 'C' })
  assert.deepEqual(parseAppWidgetQuery(sp('city=Lienz&lang=xx&unit=K')), { kind: 'weather', city: 'Lienz', lang: 'en', unit: 'C' })
  assert.equal(parseAppWidgetQuery(sp('city=%20%20')), null)
  assert.equal(parseAppWidgetQuery(sp(`city=${'x'.repeat(101)}`)), null)
  assert.equal(parseAppWidgetQuery(sp('')), null)
})

test('parseAppWidgetQuery — hike: a peak and a calendar date', () => {
  assert.deepEqual(parseAppWidgetQuery(sp('kind=hike&name=Hochstadel&lat=46.7891&lon=12.8612&elev=2681&date=2026-10-02&lang=de')),
    { kind: 'hike', peak: { name: 'Hochstadel', lat: 46.789, lon: 12.861, elev: 2681 }, date: '2026-10-02', lang: 'de', unit: 'C' })
  assert.equal(parseAppWidgetQuery(sp('kind=hike&lat=46.7&lon=12.8&elev=2681&date=tomorrow')), null)
  assert.equal(parseAppWidgetQuery(sp('kind=hike&lat=46.7&elev=2681&date=2026-10-02')), null)
})

const forecast = { city: 'Lienz', lon: 12.77, consensus: { temp: 13.4 }, sources: [{ apiId: 'open-meteo', down: false, condition: 'Partly cloudy' }] }
const hour = (t, temp, rainPct, icon, code) => ({ t, temp, rainPct, icon, code })
const outlook = {
  nowLocal: '2026-10-01T19:40', utcOffsetSec: 7200, sun: { sunrise: '07:10', sunset: '18:50' },
  hourly: [
    hour('2026-10-01T19:00', 14, 0, '⛅', 2), hour('2026-10-01T20:00', 13, 10, '☀️', 0), hour('2026-10-01T21:00', 12.4, 60, '🌧', 61),
    hour('2026-10-01T22:00', 12, 0, '☁️', 3), hour('2026-10-01T23:00', 11, 0, '☁️', 3), hour('2026-10-02T00:00', 10, 0, '☀️', 0),
    hour('2026-10-02T01:00', 9.6, 0, '☀️', 0), hour('2026-10-02T02:00', 9, 0, '☀️', 0),
  ],
  days: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']
    .map((date, i) => ({ date, tempMax: 21.3 - i, tempMin: 10.5 - i, icon: i % 2 ? '🌤' : '⛅' })),
}

test('weatherPayload — the blend now, the next 6 hours, the next 5 days, as text', () => {
  const p = weatherPayload({ forecast, outlook, lang: 'de', unit: 'C' })
  assert.equal(p.kind, 'weather')
  assert.equal(p.city, 'Lienz')
  assert.equal(p.path, '/?city=Lienz')
  assert.deepEqual(p.now, { temp: '13°', icon: '⛅', text: t('de', 'cPartlyCloudy'), sky: 'night' })
  assert.deepEqual(p.today, { hi: '21°', lo: '11°' })
  assert.equal(p.hours.length, 6)
  assert.deepEqual(p.hours[0], { t: '20:00', ts: Date.parse('2026-10-01T20:00:00Z') / 1000 - 7200, icon: '🌙', temp: '13°', rain: '10%', sky: 'night' })
  assert.deepEqual(p.hours[1], { t: '21:00', ts: Date.parse('2026-10-01T21:00:00Z') / 1000 - 7200, icon: '🌧', temp: '12°', rain: '60%', sky: 'rain' })
  assert.equal(p.days.length, 5)
  assert.deepEqual(p.days[0], { day: weekday('2026-10-02', 'de'), icon: '🌤', hi: '20°', lo: '10°' })
  assert.deepEqual(Object.keys(p.skies).sort(), ['night', 'rain'])
  assert.equal(p.skies.night.length, 3)
})

test('weatherPayload — °F everywhere', () => {
  const p = weatherPayload({ forecast, outlook, lang: 'en', unit: 'F' })
  assert.equal(p.now.temp, '56°')
  assert.equal(p.today.hi, '70°')
  assert.equal(p.hours[0].temp, '55°')
  assert.equal(p.days[0].lo, '49°')
})

test('weatherPayload — all sources down: no text, neutral icon', () => {
  const p = weatherPayload({ forecast: { ...forecast, sources: [{ apiId: 'open-meteo', down: true }] }, outlook, lang: 'en', unit: 'C' })
  assert.equal(p.now.text, '')
  assert.equal(p.now.icon, '🌤')
})

const peak = { name: 'Hochstadel', lat: 46.789, lon: 12.861, elev: 2681 }
const cap = w => w.charAt(0).toLocaleUpperCase('de') + w.slice(1)
const hike = {
  nowLocal: '2026-10-01T19:40', notes: [],
  days: [
    { date: '2026-10-01', tempMax: 8, tempMin: 1, windMax: 30, rainPct: 70, storm: 'high', icon: '⛈' },
    { date: '2026-10-02', tempMax: 11.7, tempMin: 3.6, windMax: 7, rainPct: 0, storm: 'low', icon: '⛅' },
    { date: '2026-10-04', tempMax: 6, tempMin: -2, windMax: 45.4, rainPct: 20, storm: 'moderate', icon: '🌨' },
  ],
  windows: { today: null, tomorrow: { window: { from: '2026-10-02T08:00', to: '2026-10-02T18:47', hours: 11 }, next: null } },
}

test('hikePayload — tomorrow: the summit window, green', () => {
  const p = hikePayload({ hike, peak, date: '2026-10-02', lang: 'de', unit: 'C' })
  assert.deepEqual(p, {
    kind: 'hike', peak: 'Hochstadel', day: cap(t('de', 'tomorrowWord')), path: '/hike?lat=46.789&lon=12.861&elev=2681&name=Hochstadel',
    line: '08:00–18:47', good: true, icon: '⛅', hi: '12°', lo: '4°', wind: '7 km/h', rain: '0%',
    storm: `${t('de', 'stormRisk')}: ${t('de', 'stormLow')}`, sky: 'day', skies: { day: p.skies.day },
  })
  assert.equal(p.skies.day.length, 3)
})

test('hikePayload — today in the evening: no daylight left, not green', () => {
  const p = hikePayload({ hike, peak, date: '2026-10-01', lang: 'en', unit: 'C' })
  assert.equal(p.line, t('en', 'swNoDaylight'))
  assert.equal(p.good, false)
  assert.equal(p.sky, 'storm')
})

test('hikePayload — later days: no verdict yet; unknown storm risk never green; °F; missing day', () => {
  const later = hikePayload({ hike, peak, date: '2026-10-04', lang: 'en', unit: 'F' })
  assert.equal(later.line, null)
  assert.equal(later.good, null)
  assert.equal(later.hi, '43°')
  assert.equal(later.wind, '45 km/h')
  const noStorm = hikePayload({ hike: { ...hike, notes: ['no_storm_data'] }, peak, date: '2026-10-02', lang: 'en', unit: 'C' })
  assert.equal(noStorm.good, false)
  const shut = hikePayload({ hike: { ...hike, windows: { today: null, tomorrow: { window: null, next: null } } }, peak, date: '2026-10-02', lang: 'en', unit: 'C' })
  assert.equal(shut.line, t('en', 'widgetNoWindow'))
  assert.equal(hikePayload({ hike, peak, date: '2026-10-09', lang: 'en', unit: 'C' }), null)
})

test('skyForIcon — the day icon picks the background', () => {
  assert.equal(skyForIcon('⛈'), 'storm')
  assert.equal(skyForIcon('🌦'), 'rain')
  assert.equal(skyForIcon('🌨'), 'snow')
  assert.equal(skyForIcon('☁️'), 'cloudy')
  assert.equal(skyForIcon('⛅'), 'day')
  assert.equal(skyForIcon(undefined), 'day')
})

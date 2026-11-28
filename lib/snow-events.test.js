// Owner, 2026-11-27: "the rain-event sentences follow the same idea, by the sources' weather codes or the
// temperature: headline ("Schnee wahrscheinlich 14-16"), the rain alert push ("Schnee in Lienz", "Schneeregen in
// Lienz"), and the two-hour card. If radar can't tell snow from rain, the card says "Niederschlag". The alert
// setting stays one switch; snow and mixed precipitation trigger it the same way rain does. All 13 languages, the
// push texts within their length limits, tests."
// What falls in an hour: a snow code is snow, freezing rain is rain, everything else goes by the temperature
// (below 0 snow, 0 to under 2 mixed, warmer rain). An event over several hours takes the kind that carries most
// of their chance. Rain keeps the sentences it had; snow and mixed say their word; an event whose kind nothing
// tells says the neutral word, never "rain".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hourKind, hoursKind } from './precip.js'
import { headlineToday, headlineTomorrow } from './outlook/headlines.js'
import { headlineText } from './outlook/text.js'
import { nowcastKind } from './nowcast.js'
import { nowcastSentence, nowcastShort, NOWCAST_KEYS } from './nowcast-text.js'
import { cityEvents, decide } from './push/rules.js'
import { pushText } from './push/text.js'
import { weatherPayload } from './app-widget.js'
import { LANGUAGES } from './i18n.js'

const de = (await import('./i18n/de.js')).default

test('what falls in an hour: the sources\' code where it names it, otherwise the temperature', () => {
  assert.equal(hourKind({ code: 73, temp: -4 }), 'snow')
  assert.equal(hourKind({ code: 86, temp: 1 }), 'snow', 'a snow code makes it snow where the temperature alone would say mixed')
  // from 2 degrees on the temperature decides. The code is one source's, for its own grid height, which on a coast
  // or in a valley lies above the place: Bergen on 27 November 2026 had code 73 at 3.5 degrees and an 82% chance
  assert.equal(hourKind({ code: 73, temp: 3.5 }), 'rain', 'a snow code at +3.5 is not snow at the place')
  assert.equal(hourKind({ code: 73, temp: 2 }), 'rain')
  // by the whole degrees the screen shows (owner, 2026-11-28)
  assert.equal(hourKind({ code: 73, temp: 1.6 }), 'rain', 'shown as 2: the temperature decides')
  assert.equal(hourKind({ code: 73, temp: 1.4 }), 'snow', 'shown as 1: the snow code counts')
  assert.equal(hourKind({ code: 61, temp: -0.4 }), 'mixed', 'shown as 0: rain and snow, not snow')
  assert.equal(hourKind({ code: 73 }), 'snow', 'a snow code and no temperature: snow')
  assert.equal(hourKind({ code: 66, temp: -2 }), 'rain', 'freezing rain is rain: it is what falls')
  assert.equal(hourKind({ code: 56, temp: -1 }), 'rain', 'freezing drizzle too')
  assert.equal(hourKind({ code: 61, temp: -3 }), 'snow', 'a rain code below freezing goes by the temperature')
  assert.equal(hourKind({ code: 61, temp: 1 }), 'mixed')
  assert.equal(hourKind({ code: 61, temp: 5 }), 'rain')
  assert.equal(hourKind({ code: null, temp: -1 }), 'snow')
  assert.equal(hourKind({ code: 3 }), undefined, 'no snow code and no temperature: nothing tells')
  assert.equal(hourKind(undefined), undefined)
})

test('an event over several hours: the kind that carries most of their chance', () => {
  const h = (temp, rainPct, code = 61) => ({ temp, rainPct, code })
  assert.equal(hoursKind([h(-4, 80), h(-3, 70), h(3, 60)]), 'snow')
  assert.equal(hoursKind([h(1, 80), h(1.5, 70), h(-1, 20)]), 'mixed')
  assert.equal(hoursKind([h(6, 80), h(-2, 10)]), 'rain')
  assert.equal(hoursKind([h(-2, 50), h(6, 50)]), 'rain', 'a tie goes to rain, as a summit day')
  assert.equal(hoursKind([{ rainPct: 80 }, { rainPct: 70 }]), undefined, 'hours without code and temperature')
  assert.equal(hoursKind([]), undefined)
  assert.equal(hoursKind(undefined), undefined)
})

// hours of one day from 13:00, city-local
const hours = (date, from, items) => items.map((x, i) => ({ t: `${date}T${String(from + i).padStart(2, '0')}:00`, temp: 5, rainPct: 5, rainVotes: 0, rainCallers: 9, windKmh: 10, code: 3, ...x }))
const D = '2026-12-01'
const wet = (temp, code = 61) => ({ temp, code, rainPct: 80, rainVotes: 7 })

test('the headline carries what falls in its wet hours', () => {
  const today = items => headlineToday(hours(D, 13, items), { todayLocal: D })
  assert.equal(today([{}, wet(-3), wet(-4), {}]).precip, 'snow')
  assert.equal(today([{}, wet(-3), wet(-4), {}]).code, 'rain_window', 'the code stays: it names the event, not what falls')
  assert.equal(today([{}, wet(1), wet(1.4), {}]).precip, 'mixed')
  assert.equal(today([{}, wet(1.6), wet(1.7), {}]).precip, 'rain', 'both hours read "2°" (whole degrees since 2026-11-28; 1.5 stood in the line above until then)')
  assert.equal(today([{}, wet(8), wet(7), {}]).precip, 'rain', 'rain says so too: a headline without the field is of unknown kind')
  assert.equal(today([wet(-2, 73), wet(-2, 73), {}]).precip, 'snow', 'snowing now')
  assert.equal(today([wet(-2, 66), wet(-1, 66), {}]).precip, 'rain', 'freezing rain now: rain')
  assert.equal('precip' in today([{}, { rainPct: 80, temp: undefined, code: undefined }, {}]), false, 'nothing tells: no field')
  assert.equal('precip' in today([{}, {}, {}]), false, 'a dry day has nothing to name')
  const tomorrow = headlineTomorrow(hours('2026-12-02', 0, Array.from({ length: 24 }, () => wet(-5, 71))), [], [], { todayLocal: D })
  assert.deepEqual([tomorrow.code, tomorrow.precip], ['rain_all_day', 'snow'])
})

const words = { todayLocal: D }
const win = precip => ({ code: 'rain_window', from: `${D}T14:00`, to: `${D}T16:00`, agree: 7, total: 9, ...(precip ? { precip } : {}) })

test('the headline says it: "Schnee wahrscheinlich heute 14:00-16:00"', () => {
  const title = (h, which = 'today') => headlineText('de', which, h, words).title
  assert.equal(title(win('snow')), 'Schnee wahrscheinlich heute 14:00-16:00')
  assert.equal(title(win('mixed')), 'Schneeregen wahrscheinlich heute 14:00-16:00')
  assert.equal(title(win('rain')), 'Regen wahrscheinlich heute 14:00-16:00', 'rain reads as before')
  assert.equal(title(win()), 'Niederschlag wahrscheinlich heute 14:00-16:00', 'a headline of unknown kind: the neutral word, never rain')
  const now = (precip, extra = {}) => ({ code: 'rain_now', until: `${D}T15:00`, agree: 7, total: 9, precip, ...extra })
  assert.equal(title(now('snow')), 'Schnee jetzt, bis etwa 15:00')
  assert.equal(title(now('rain')), de.hlRainNow.replace('{until}', '15:00'))
  assert.equal(title(now('snow', { until: null })), 'Schnee für den Rest des Tages')
  assert.equal(title(now('mixed', { until: null, night: true })), 'Schneeregen die ganze Nacht')
  assert.equal(title(now('rain', { until: null, night: true })), de.hlRainAllNight)
  assert.equal(title({ code: 'rain_all_day', precip: 'snow' }, 'tomorrow'), 'Morgen fast durchgehend Schnee')
  assert.equal(title({ code: 'rain_all_day', precip: 'rain' }, 'tomorrow'), de.hlRainAllDayTomorrow)
  assert.equal(headlineText('en', 'today', win('snow'), words).title, 'Snow likely 14:00-16:00 today')
  assert.equal(headlineText('en', 'today', win('mixed'), words).title, 'Rain and snow likely 14:00-16:00 today')
  assert.equal(headlineText('en', 'today', win(), words).title, 'Precipitation likely 14:00-16:00 today')
})

// a nowcast of ten quarter hours from 13:00 city-local (offset 0 keeps the clock simple), wet from `from` on
const NOW = Date.parse(`${D}T13:02:00Z`)
const nc = (wetFrom, wetTo = 10) => ({ precision: 'fine', models: 3, utcOffsetSec: 0, steps: Array.from({ length: 10 }, (_, i) => ({ t: new Date(Date.parse(`${D}T13:00:00Z`) + i * 15 * 60e3).toISOString().slice(0, 16), mm: i >= wetFrom && i < wetTo ? 0.4 : 0, wet: i >= wetFrom && i < wetTo, agree: 1 })) })
const cityHours = temp => hours(D, 13, [{ temp, rainPct: 70, code: 61 }, { temp, rainPct: 80, code: 61 }, { temp, rainPct: 60, code: 61 }])

test('the two-hour card: the kind comes from the forecast hours its wet quarters fall in', () => {
  assert.equal(nowcastKind(nc(2), NOW, cityHours(-4)), 'snow')
  assert.equal(nowcastKind(nc(2), NOW, cityHours(1)), 'mixed')
  assert.equal(nowcastKind(nc(2), NOW, cityHours(7)), 'rain')
  assert.equal(nowcastKind(nc(2), NOW, []), undefined, 'no hours: it cannot tell')
  assert.equal(nowcastKind(nc(2), NOW, undefined), undefined)
  assert.equal(nowcastKind(nc(2), NOW, hours('2026-12-05', 13, [{ temp: -4 }])), undefined, 'hours of another day do not count')
  assert.equal(nowcastKind(nc(10), NOW, cityHours(-4)), undefined, 'a dry two hours have nothing to name')
})

const start = { kind: 'start', at: `${D}T13:30`, minutes: 28, until: `${D}T14:15`, duration: 45, intensity: 'light', agree: 1 }

test('the two-hour card says it, and "Niederschlag" when it cannot tell', () => {
  assert.equal(nowcastSentence('de', start, 'snow'), 'Schnee ab ~13:30 für etwa 45 Min. · leicht')
  assert.equal(nowcastSentence('de', start, 'mixed'), 'Schneeregen ab ~13:30 für etwa 45 Min. · leicht')
  assert.equal(nowcastSentence('de', start, 'rain'), 'Regen ab ~13:30 für etwa 45 Min. · leicht', 'rain reads as before')
  assert.equal(nowcastSentence('de', start), 'Niederschlag ab ~13:30 für etwa 45 Min.', 'no kind: the neutral word, and no adjective that would have to agree with it')
  assert.equal(nowcastSentence('de', { ...start, until: null, duration: null, intensity: 'heavy' }, 'snow'), 'Schnee ab ~13:30 · stark')
  assert.equal(nowcastSentence('de', { kind: 'stop', until: `${D}T13:45`, intensity: 'moderate' }, 'snow'), 'Schnee jetzt, bis ~13:45')
  assert.equal(nowcastSentence('de', { kind: 'all', intensity: 'light' }, 'snow'), 'Schnee in den nächsten 2 Stunden · leicht')
  assert.equal(nowcastSentence('de', { kind: 'all', intensity: 'light' }), 'Niederschlag in den nächsten 2 Stunden')
  assert.equal(nowcastSentence('de', { kind: 'dry' }, 'snow'), de.ncDry, 'dry is dry')
  assert.equal(nowcastShort('de', start, 'snow'), 'Schnee ~13:30')
  assert.equal(nowcastShort('de', start, 'rain'), 'Regen ~13:30')
  assert.equal(nowcastShort('de', start), 'Niederschlag ~13:30')
  assert.equal(nowcastShort('de', { kind: 'stop', until: `${D}T13:45` }, 'mixed'), 'Schneeregen bis ~13:45')
  assert.equal(nowcastSentence('en', start, 'mixed'), 'Rain and snow from ~13:30 for about 45 min · light')
})

// an outlook as the alert rules read it: two dry hours at that temperature, then wet (city clock = UTC here)
const outlook = (temp, code = 61) => ({
  city: 'Lienz', utcOffsetSec: 0, nowLocal: `${D}T13:00`, sun: { sunrise: '07:30', sunset: '16:20' },
  hourly: hours(D, 13, [{ temp }, { temp }, { temp, code, rainPct: 80 }, { temp, code, rainPct: 90 }]),
  days: [{ date: D, tempMax: 3, tempMin: -6 }],
})
const DEVICE = { alert_rain: true, alert_storm: true, alert_severe: true, alert_heat: true, briefing: false, briefing_hour: 7 }
const at = hhmm => Date.parse(`${D}T${hhmm}:00Z`)

test('the alert: one switch, snow and mixed precipitation trigger it as rain does, and the title says what falls', () => {
  const title = (temp, code) => {
    const msgs = decide(DEVICE, cityEvents(outlook(temp, code), at('13:05')), [])
    assert.deepEqual(msgs.map(m => m.kind), ['rain'], `one alert of the rain switch at ${temp} degrees`)
    return pushText('de', 'C', msgs[0]).title
  }
  assert.equal(title(-4), 'Schnee in Lienz')
  assert.equal(title(1), 'Schneeregen in Lienz')
  assert.equal(title(8), 'Regen in Lienz')
  assert.equal(title(-2, 66), 'Regen in Lienz', 'freezing rain is rain')
  // the switch off: no alert, whatever falls
  assert.deepEqual(decide({ ...DEVICE, alert_rain: false }, cityEvents(outlook(-4), at('13:05')), []), [])
  // an event without a kind (an hour with neither code nor temperature): the neutral title
  assert.equal(pushText('de', 'C', { kind: 'rain', vars: { city: 'Lienz', from: `${D}T15:00`, pct: 80 } }).title, 'Niederschlag in Lienz')
  // from the 15-minute nowcast: the kind of the forecast hour the rain starts in
  const fromNowcast = decide(DEVICE, cityEvents(outlook(-4), at('13:02'), nc(2)), [])
  assert.deepEqual([fromNowcast[0].kind, fromNowcast[0].vars.nowcast, fromNowcast[0].vars.precip], ['rain', true, 'snow'])
  assert.equal(pushText('de', 'C', fromNowcast[0]).title, 'Schnee in Lienz')
})

// Owner, 2026-11-27: "yes to the rename: "Vor Regen oder Schnee in {city} Bescheid bekommen?" and "Bald Regen oder
// Schnee", 13 languages". The prompt's button turns on this one switch, and the switch now announces snow by name:
// a prompt and a name that said only rain promised less than it sends.
test('the prompt and the switch say what the switch sends: rain or snow', async () => {
  assert.equal(de.promptTitle, 'Vor Regen oder Schnee in {city} Bescheid bekommen?')
  assert.equal(de.notifRain, 'Bald Regen oder Schnee')
  const en = (await import('./i18n/en.js')).default
  assert.equal(en.promptTitle, 'Get a heads-up before rain or snow in {city}?')
  assert.equal(en.notifRain, 'Rain or snow soon')
  // the stem of each language's word for snow, as its sentence inflects it
  const SNOW = { en: 'snow', de: 'Schnee', fr: 'neige', es: 'niev', it: 'neve', nl: 'sneeuw', pl: 'śnieg', cs: 'sn', sl: 'sneg', pt: 'neve', ja: '雪', zh: '雪', ko: '눈' }
  for (const { code } of LANGUAGES) {
    const pack = (await import(`./i18n/${code}.js`)).default
    assert.ok(pack.promptTitle.includes('{city}'), `${code}: the prompt names the place`)
    for (const k of ['promptTitle', 'notifRain']) assert.ok(pack[k].includes(SNOW[code]), `${code}: ${k} names snow ("${pack[k]}")`)
  }
})

// Owner, 2026-11-28: "Yes: "Erledigt. Du hörst von uns, bevor es regnet oder schneit." and the settings summary
// line the same way, 13 languages."
test('the prompt\'s answer and the settings\' summary line say rain or snow', async () => {
  assert.equal(de.promptDone, 'Erledigt. Du hörst von uns, bevor es regnet oder schneit.')
  assert.equal(de.notifWhat, 'Bald Regen oder Schnee, Gewitter, Unwetter, Hitze, ein Morgenbericht und deine geplanten Touren. Du wählst aus, welche.')
  const en = (await import('./i18n/en.js')).default
  assert.equal(en.promptDone, 'Done. You’ll hear from us before rain or snow.')
  assert.equal(en.notifWhat, 'Rain or snow soon, thunderstorms, severe weather, heat, a morning briefing and your planned hikes. You choose which.')
  // the stem of each language's word for snow, noun or verb, as its sentence inflects it
  const SNOW = { en: /snow/, de: /schnei/, fr: /neige/, es: /niev/, it: /neve/, nl: /sneeuw/, pl: /śnieg/, cs: /sněh/, sl: /sneg/, pt: /neve/, ja: /雪/, zh: /雪/, ko: /눈/ }
  for (const { code } of LANGUAGES) {
    const pack = (await import(`./i18n/${code}.js`)).default
    assert.match(pack.promptDone, SNOW[code], `${code}: the answer names snow ("${pack.promptDone}")`)
    // the summary names the switch as the settings name it (case aside), as it does the other switches
    assert.ok(pack.notifWhat.toLowerCase().startsWith(pack.notifRain.toLowerCase()), `${code}: the summary starts with "${pack.notifRain}" ("${pack.notifWhat}")`)
  }
})

test('the morning briefing reads the same headline', () => {
  const ev = cityEvents(outlook(-4), at('13:05'))
  assert.equal(ev.briefing.headline.precip, 'snow')
  const msg = { kind: 'briefing', vars: { city: 'Lienz', ...ev.briefing } }
  assert.match(pushText('de', 'C', msg).body, /Schnee wahrscheinlich heute 15:00-17:00/)
})

test('the widget\'s line follows', () => {
  const o = { ...outlook(-4), days: [{ date: D, tempMax: 3, tempMin: -6 }] }
  const forecast = { city: 'Lienz', lon: 12.8, consensus: { temp: -4, windKmh: 5 } }
  const payload = weatherPayload({ forecast, outlook: o, lang: 'de', unit: 'C', now: NOW, nowcast: nc(2) })
  assert.equal(payload.now.text, 'Schnee ~13:30')
})

// Limits this test sets (the repository had none): a title of 65 characters and a body of 178 are what the
// notification shades show before they cut (Android's collapsed title, iOS's lock-screen body). The city here
// has 30 characters; real names are shorter.
test('the push texts fit: every language, every kind', async () => {
  const city = 'Sankt Leonhard im Pitztal Nord'
  for (const { code } of LANGUAGES) {
    for (const precip of ['rain', 'snow', 'mixed', undefined]) {
      for (const vars of [{ from: `${D}T15:00`, pct: 100 }, { from: `${D}T15:00`, nowcast: true, minutes: 55, duration: 120, intensity: 'moderate' }]) {
        const { title, body } = pushText(code, 'C', { kind: 'rain', vars: { city, precip, ...vars } })
        assert.ok(title.length <= 65, `${code} ${precip}: title of ${title.length} characters: ${title}`)
        assert.ok(body.length <= 178, `${code} ${precip}: body of ${body.length} characters`)
        assert.ok(title.includes(city) && !/[{}]/.test(title + body), `${code} ${precip}: ${title} | ${body}`)
      }
    }
  }
})

test('13 languages: every new sentence keeps its parts and none of them names rain', async () => {
  const plain = s => s.replace(/\{[a-zA-Z]+\}/g, '').toLowerCase()
  const KEYS = { hlPrecipNow: ['until'], hlPrecipWindow: ['from', 'to', 'day'], hlPrecipRestOfDay: [], hlPrecipAllNight: [], hlPrecipAllDayTomorrow: [],
    ncPrecipStart: ['at', 'intensity'], ncPrecipStartFor: ['at', 'duration', 'intensity'], ncPrecipStop: ['until'], ncPrecipAll: ['intensity'], ncPrecipShortStart: ['at'], ncPrecipShortStop: ['until'] }
  for (const { code } of LANGUAGES) {
    const pack = (await import(`./i18n/${code}.js`)).default
    assert.ok(pack.reasonPrecip && !plain(pack.reasonPrecip).includes(pack.reasonRain.toLowerCase()), `${code}: the neutral word`)
    for (const [k, parts] of Object.entries(KEYS)) {
      assert.ok(pack[k], `${code}: ${k}`)
      assert.match(pack[k], /\{what\}/, `${code}: ${k} names what falls`)
      for (const p of parts) assert.ok(pack[k].includes(`{${p}}`), `${code}: ${k} keeps {${p}}`)
      assert.ok(!plain(pack[k]).includes(pack.reasonRain.toLowerCase()), `${code}: ${k} says rain ("${pack[k]}")`)
    }
    // the intensity words stand beside snow too: none of them may be a word for rain
    for (const k of ['ncLight', 'ncModerate', 'ncHeavy']) assert.ok(!pack[k].includes(pack.reasonRain) && !/雨/.test(pack[k]), `${code}: ${k} is a word for rain ("${pack[k]}")`)
    // each kind's sentence holds its word, in every language
    for (const [precip, word] of [['snow', pack.reasonSnow], ['mixed', pack.reasonMixed]]) {
      const title = headlineText(code, 'today', win(precip), words).title
      assert.ok(title.toLowerCase().includes(word.toLowerCase()), `${code}: ${title}`)
      assert.ok(nowcastSentence(code, start, precip).toLowerCase().includes(word.toLowerCase()), `${code}: ${nowcastSentence(code, start, precip)}`)
    }
  }
  for (const k of Object.keys(KEYS).filter(k => k.startsWith('nc'))) assert.ok(NOWCAST_KEYS.includes(k), `${k} is listed with the two-hour texts`)
})

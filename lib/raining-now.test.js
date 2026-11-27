// Owner, 2026-11-27: ""Quellen melden gerade Regen" beside the current temperature follows the same rule." The line
// counts the sources that report precipitation right now, snow included, and called all of it rain. It now says
// what they report, by the rule of a forecast hour (lib/precip.js hourKind) with the temperature shown beside the
// line: below 0 snow, 0 to under 2 mixed unless they say snow, 2 and warmer rain; freezing rain is rain. The kind
// most of the reporting sources come to names the line; a line whose reports nothing tells says "precipitation".
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reportedKind, PRECIP_WORDS } from './precip.js'
import { rainNowKey } from './forecast-hints.js'
import { blendNow } from './consensus.js'
import { LANGUAGES } from './i18n.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: NowLine } = await import('../app/components/outlook/NowLine.jsx')
const de = (await import('./i18n/de.js')).default

const said = (...conditions) => conditions.map((condition, i) => ({ apiId: `s${i}`, displayName: `S${i}`, temp: 0, condition }))

test('what the reporting sources report, in the frame of the temperature beside the line', () => {
  // the words as the sources' stored reports of November 2026 have them: "snow", "light snow", "snow, overcast"
  assert.equal(reportedKind(said('Snow', 'Light snow', 'snow, overcast'), -3), 'snow')
  assert.equal(reportedKind(said('Snow', 'Snow'), 1), 'snow', 'they say snow where the temperature alone would say mixed')
  assert.equal(reportedKind(said('Snow', 'Snow'), 3.5), 'rain', 'from 2 degrees on the temperature decides, as in a forecast hour')
  assert.equal(reportedKind(said('Rain', 'Drizzle'), -2), 'snow', 'rain words below freezing: snow')
  assert.equal(reportedKind(said('Rain', 'rain showers'), 1), 'mixed')
  assert.equal(reportedKind(said('Rain', 'Thunderstorm', 'Hail'), 12), 'rain')
  assert.equal(reportedKind(said('Freezing rain', 'Heavy freezing rain', 'Freezing drizzle'), -2), 'rain', 'freezing rain is rain: it is what falls')
  assert.equal(reportedKind(said('Sleet', 'Sleet'), 0.5), 'mixed')
  assert.equal(reportedKind(said('Sleet', 'Sleet'), -4), 'mixed', 'they say sleet: mixed, also below freezing')
  assert.equal(reportedKind(said('Sleet'), 4), 'rain')
  // the kind most of them come to; two that tie: rain
  assert.equal(reportedKind(said('Snow', 'Snow', 'Snow', 'Freezing rain'), -1), 'snow')
  assert.equal(reportedKind(said('Snow', 'Freezing rain'), -1), 'rain')
  // sources that report no precipitation do not count, whatever their words
  assert.equal(reportedKind(said('Cloudy', 'Freezing fog', 'Clear', 'Snow'), -3), 'snow')
  assert.equal(reportedKind(said('Cloudy', 'Freezing fog', ''), -3), undefined, 'nobody reports precipitation: nothing to name')
  assert.equal(reportedKind(said('Rain'), undefined), undefined, 'rain words and no temperature: nothing tells')
  assert.equal(reportedKind(said('Snow'), undefined), 'snow')
  assert.equal(reportedKind(undefined, -3), undefined)
})

test('the count and the word read the same reports', () => {
  // lib/consensus.js counts "raining now" with the words lib/precip.js names: one list, so the line never counts
  // a report it cannot word
  const results = said('Snow', 'Light snow', 'Sleet', 'Cloudy', 'Freezing fog').map(s => ({ ...s, temp: -2, rainPct: 0, windKmh: 5 }))
  const { rainingNow } = blendNow(results, [])
  assert.deepEqual(rainingNow, { count: 3, total: 5 })
  assert.equal(results.filter(r => PRECIP_WORDS.test(r.condition)).length, rainingNow.count)
})

test('which sentence the line says', () => {
  const data = (temp, ...conditions) => ({ consensus: { temp }, sources: said(...conditions) })
  assert.equal(rainNowKey(data(-3, 'Snow', 'Snow')), 'snowNowHint')
  assert.equal(rainNowKey(data(1, 'Rain', 'Rain')), 'mixedNowHint')
  assert.equal(rainNowKey(data(9, 'Rain', 'Rain')), 'rainNowHint')
  assert.equal(rainNowKey(data(-3, 'Cloudy')), 'precipNowHint', 'the reporting sources are not among those shown: the neutral sentence, never rain')
  assert.equal(rainNowKey({ consensus: {}, sources: said('Rain') }), 'precipNowHint')
})

// the line as the page renders it: most sources report precipitation, so the line shows
const page = (temp, conditions, count = conditions.length) => {
  const sources = said(...conditions, 'Cloudy').map(s => ({ ...s, temp, rainPct: 60, windKmh: 5 }))
  const data = { city: 'Kiruna', lon: 20.2, consensus: { temp, feelsLike: temp - 4, rainPct: 70, windKmh: 6, confidencePct: 80 }, sources, rainingNow: { count, total: sources.length } }
  return render(h(NowLine, { data, unit: 'C', lang: 'de', showT: v => v }))
}

test('the line beside the current temperature says what falls', () => {
  const snow = page(-9, ['Snow', 'Snow', 'Light snow'])
  assert.match(snow, /3 von 4 Quellen melden gerade Schnee/)
  assert.doesNotMatch(snow, /melden gerade Regen/, 'no rain at -9 degrees')
  assert.match(page(1, ['Rain', 'Rain', 'Drizzle']), /3 von 4 Quellen melden gerade Schneeregen/)
  assert.match(page(9, ['Rain', 'Rain', 'Drizzle']), /3 von 4 Quellen melden gerade Regen/, 'rain reads as before')
  assert.match(page(-2, ['Freezing rain', 'Freezing rain', 'Freezing drizzle']), /melden gerade Regen/)
  // the count names sources the page is not given (a licence keeps some private): the neutral sentence
  assert.match(page(-9, [], 3).replace(/<[^>]+>/g, ''), /3 von 1 Quellen melden gerade Niederschlag/)
})

test('13 languages: the three new sentences keep their numbers; snow and the neutral one do not name rain', async () => {
  assert.equal(de.snowNowHint, '{n} von {total} Quellen melden gerade Schnee')
  assert.equal(de.mixedNowHint, '{n} von {total} Quellen melden gerade Schneeregen')
  assert.equal(de.precipNowHint, '{n} von {total} Quellen melden gerade Niederschlag')
  // the stem of each language's word for snow, as its sentence inflects it
  const SNOW = { en: 'snow', de: 'Schnee', fr: 'neige', es: 'nieve', it: 'neve', nl: 'sneeuw', pl: 'śnieg', cs: 'sníh', sl: 'sneg', pt: 'neve', ja: '雪', zh: '雪', ko: '눈' }
  for (const { code } of LANGUAGES) {
    const pack = (await import(`./i18n/${code}.js`)).default
    for (const k of ['snowNowHint', 'mixedNowHint', 'precipNowHint']) {
      assert.ok(pack[k], `${code}: ${k}`)
      assert.ok(pack[k].includes('{n}') && pack[k].includes('{total}'), `${code}: ${k} keeps its numbers`)
    }
    assert.ok(pack.snowNowHint.includes(SNOW[code]), `${code}: the snow sentence names snow ("${pack.snowNowHint}")`)
    for (const k of ['snowNowHint', 'precipNowHint']) assert.ok(!pack[k].toLowerCase().includes(pack.reasonRain.toLowerCase()), `${code}: ${k} names rain ("${pack[k]}")`)
  }
})

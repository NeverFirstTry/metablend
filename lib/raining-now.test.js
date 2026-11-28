// Owner, 2026-11-27: ""Quellen melden gerade Regen" beside the current temperature follows the same rule." The line
// counts the sources that report precipitation right now, snow included, and called all of it rain.
// Owner, 2026-11-28: "Quote the sources: the line says what most reporting sources report, at any temperature,
// since it says "sources report". The temperature rule only applies where no source names a kind." So a source that
// says snow counts as snow at 4 degrees, one that says rain as rain at -2; the kind most of them name names the
// line. Where none names a kind (showers, hail, thunder, or the reporting sources are not among those shown), the
// temperature rule does, by the whole degrees shown beside the line; "precipitation" when that tells nothing either.
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

test('what most of the reporting sources report, at any temperature', () => {
  // the words as the sources' stored reports of November 2026 have them: "snow", "light snow", "snow, overcast"
  assert.equal(reportedKind(said('Snow', 'Light snow', 'snow, overcast'), -3), 'snow')
  assert.equal(reportedKind(said('Snow', 'Snow'), 3.5), 'snow', 'they say snow: the line quotes them, also at 3.5 degrees')
  assert.equal(reportedKind(said('Rain', 'Drizzle'), -2), 'rain', 'they say rain and drizzle: rain, also below freezing')
  assert.equal(reportedKind(said('Rain', 'rain showers'), 1), 'rain')
  assert.equal(reportedKind(said('Freezing rain', 'Heavy freezing rain', 'Freezing drizzle'), -2), 'rain', 'freezing rain is rain: it is what falls')
  assert.equal(reportedKind(said('Sleet', 'Sleet'), -4), 'mixed')
  assert.equal(reportedKind(said('Sleet'), 4), 'mixed', 'they say sleet: rain and snow, also at 4 degrees')
  assert.equal(reportedKind(said('Rain and snow', 'Wintry showers'), 6), 'mixed')
  // most of those that name a kind
  assert.equal(reportedKind(said('Snow', 'Snow', 'Snow', 'Rain'), 4), 'snow')
  assert.equal(reportedKind(said('Rain', 'Rain', 'Snow'), -5), 'rain')
  assert.equal(reportedKind(said('Snow', 'Thunderstorm', 'Hail', 'Showers'), 9), 'snow', 'one names a kind, three do not: the one that names it')
  // sources that report no precipitation do not count, whatever their words
  assert.equal(reportedKind(said('Cloudy', 'Freezing fog', 'Clear', 'Snow'), 5), 'snow')
  assert.equal(reportedKind(said('Snow'), undefined), 'snow', 'a named kind needs no temperature')
})

test('the temperature rule only where no source names a kind, by the whole degrees shown', () => {
  assert.equal(reportedKind(said('Thunderstorm', 'Hail', 'Showers'), 12), 'rain')
  assert.equal(reportedKind(said('Thunderstorm', 'Showers'), -3), 'snow')
  assert.equal(reportedKind(said('Showers'), -0.4), 'mixed', 'the screen shows 0')
  // the count names sources the page is not given (a licence keeps some private): none shown names a kind
  assert.equal(reportedKind(said('Cloudy', 'Freezing fog', ''), -3), 'snow')
  assert.equal(reportedKind(undefined, -3), 'snow')
  assert.equal(reportedKind(said('Showers'), undefined), undefined, 'no kind named and no temperature: nothing tells')
  // as many say snow as say rain: nothing is "most", so the temperature decides
  assert.equal(reportedKind(said('Snow', 'Rain'), -1), 'snow')
  assert.equal(reportedKind(said('Snow', 'Rain'), 6), 'rain')
  assert.equal(reportedKind(said('Snow', 'Rain'), undefined), undefined)
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
  assert.equal(rainNowKey(data(4, 'Snow', 'Snow')), 'snowNowHint', 'quoted at 4 degrees too')
  assert.equal(rainNowKey(data(-2, 'Rain', 'Rain')), 'rainNowHint', 'they say rain')
  assert.equal(rainNowKey(data(9, 'Rain', 'Rain')), 'rainNowHint')
  assert.equal(rainNowKey(data(5, 'Sleet')), 'mixedNowHint')
  assert.equal(rainNowKey(data(1, 'Showers', 'Thunderstorm')), 'mixedNowHint', 'no kind named: the temperature rule')
  assert.equal(rainNowKey(data(-3, 'Cloudy')), 'snowNowHint', 'the reporting sources are not among those shown: the temperature rule')
  assert.equal(rainNowKey({ consensus: {}, sources: said('Showers') }), 'precipNowHint', 'nothing tells: the neutral sentence, never rain')
})

// the line as the page renders it: most sources report precipitation, so the line shows
const page = (temp, conditions, count = conditions.length) => {
  const sources = said(...conditions, 'Cloudy').map(s => ({ ...s, temp, rainPct: 60, windKmh: 5 }))
  const data = { city: 'Kiruna', lon: 20.2, consensus: { temp, feelsLike: temp - 4, rainPct: 70, windKmh: 6, confidencePct: 80 }, sources, rainingNow: { count, total: sources.length } }
  return render(h(NowLine, { data, unit: 'C', lang: 'de', showT: v => v }))
}

test('the line beside the current temperature says what the sources report', () => {
  const snow = page(-9, ['Snow', 'Snow', 'Light snow'])
  assert.match(snow, /3 von 4 Quellen melden gerade Schnee/)
  assert.doesNotMatch(snow, /melden gerade Regen/, 'no rain where they say snow')
  assert.match(page(4, ['Snow', 'Snow', 'Light snow']), /3 von 4 Quellen melden gerade Schnee/, 'quoted at 4 degrees too')
  assert.match(page(-2, ['Rain', 'Rain', 'Drizzle']), /3 von 4 Quellen melden gerade Regen/, 'they say rain below freezing: the line says so')
  assert.match(page(9, ['Rain', 'Rain', 'Drizzle']), /3 von 4 Quellen melden gerade Regen/, 'rain reads as before')
  assert.match(page(1, ['Showers', 'Showers', 'Thunderstorm']), /3 von 4 Quellen melden gerade Schneeregen/, 'no kind named: the temperature rule')
  // the count names sources the page is not given (a licence keeps some private): the temperature rule
  assert.match(page(-9, [], 3).replace(/<[^>]+>/g, ''), /3 von 1 Quellen melden gerade Schnee/)
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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { t } from './i18n.js'
import { ogText, OG_BRAND } from './og-card.js'
import { LANDING_LANGS, landingPath, landingAlternates, landingMetadata, exampleFrom, exampleForecast } from './landing.js'
import { spreadSentence } from './spread.js'
import { tempFormatter } from './outlook/text.js'

const FORECAST = {
  city: 'Vienna',
  consensus: { temp: 3.4, confidencePct: 85, rainPct: 10, windKmh: 12 },
  sources: [
    { apiId: 'open-meteo', displayName: 'Open-Meteo', temp: 3, condition: 'Clear', latency: 120 },
    { apiId: 'icon', displayName: 'DWD ICON', temp: 4, condition: 'Clear', responseMs: 90 },
    { apiId: 'down', temp: 30, condition: 'Rain', down: true },
    { apiId: 'metablend', temp: 25, condition: 'Rain', synthetic: true },
    { apiId: 'gfs', displayName: 'NOAA GFS', temp: 2, condition: 'Clear' },
    { apiId: 'jma', displayName: 'JMA', temp: 3, condition: 'Clear' },
    { apiId: 'chmi', displayName: 'CHMI ALADIN', temp: 4, condition: 'Clear' },
  ],
}

test('landing pages: every language but English has its own page; English stays on /', () => {
  assert.equal(landingPath('en'), '/')
  assert.equal(landingPath('de'), '/de')
  assert.equal(LANDING_LANGS.length, 12)
  assert.ok(!LANDING_LANGS.includes('en'))
})

test('hreflang: each language points at its page, with the region or script tag the text is written for', () => {
  const { canonical, languages } = landingAlternates('fr')
  assert.equal(canonical, '/fr')
  assert.equal(languages['x-default'], '/')
  assert.equal(languages.en, '/')
  assert.equal(languages.de, '/de')
  assert.equal(languages['pt-BR'], '/pt')
  assert.equal(languages['zh-Hans'], '/zh')
  assert.equal(Object.keys(languages).length, 14) // 13 languages + x-default
  assert.equal(landingAlternates('en').canonical, '/')
})

test('metadata: every language page has its own title, a description search engines keep whole, and its own URL', () => {
  const titles = new Set()
  for (const lang of LANDING_LANGS) {
    const m = landingMetadata(lang)
    titles.add(m.title.absolute)
    assert.ok(m.title.absolute.startsWith('MetaBlend'), lang)
    assert.ok(m.description.length <= 160, `${lang}: ${m.description.length} characters`)
    assert.equal(m.alternates.canonical, `/${lang}`)
    assert.equal(m.openGraph.url, `/${lang}`)
    assert.equal(m.openGraph.title, m.title.absolute)
    assert.match(m.openGraph.locale, /^[a-z]{2}_[A-Z]{2}$/, lang)
  }
  assert.equal(titles.size, 12)
})

test('example: only what the page shows goes into its HTML, and it says what the forecast says', () => {
  assert.deepEqual(exampleFrom(FORECAST), {
    temp: 3.4,
    agree: 85,
    condition: 'Clear',
    // no failed or synthetic source, and nothing the page doesn't show
    sources: [
      { apiId: 'open-meteo', displayName: 'Open-Meteo', temp: 3 }, { apiId: 'icon', displayName: 'DWD ICON', temp: 4 }, { apiId: 'gfs', displayName: 'NOAA GFS', temp: 2 },
      { apiId: 'jma', displayName: 'JMA', temp: 3 }, { apiId: 'chmi', displayName: 'CHMI ALADIN', temp: 4 },
    ],
  })
  const fmt = tempFormatter('C')
  const fromExample = exampleFrom(FORECAST)
  assert.equal(spreadSentence('en', fromExample.sources, fmt, fromExample.agree), spreadSentence('en', FORECAST.sources, fmt, 85))
})

test('share images: the bundled fonts hold every character on each card', () => {
  const glyphs = JSON.parse(fs.readFileSync(new URL('./og-fonts/glyphs.json', import.meta.url), 'utf8'))
  for (const lang of ['en', ...LANDING_LANGS]) { // the start page's card is the English one
    const inFont = new Set([...(glyphs[lang] ?? ''), ...glyphs.latin, ' '])
    const missing = [...ogText(key => t(lang, key)), ...OG_BRAND].filter(ch => !inFont.has(ch))
    assert.deepEqual(missing, [], `${lang}: run node scripts/brand/og-fonts.mjs`)
  }
})

const answers = (status, body) => async () => new Response(JSON.stringify(body), { status })

test('exampleForecast: Vienna, in English so it shares the CDN copy, refreshed at most hourly', async () => {
  let asked, options
  const example = await exampleForecast({ fetcher: async (url, o) => { asked ??= url; options ??= o; return new Response(JSON.stringify(FORECAST)) }, building: false })
  assert.match(asked, /\/api\/forecast\?city=vienna&lang=en$/)
  assert.equal(options.next.revalidate, 3600)
  assert.equal(example.temp, 3.4)
})

test('exampleForecast: a failed refresh throws, so the last good page stays up', async () => {
  await assert.rejects(exampleForecast({ fetcher: answers(502, {}), building: false }))
  await assert.rejects(exampleForecast({ fetcher: answers(404, { error: 'not found' }), building: false }))
  await assert.rejects(exampleForecast({ fetcher: async () => { throw new Error('network') }, building: false }))
})

test('exampleForecast: during a build a failure leaves the example out rather than failing the deploy', async () => {
  assert.equal(await exampleForecast({ fetcher: answers(502, {}), building: true }), null)
  assert.equal(await exampleForecast({ fetcher: async () => { throw new Error('network') }, building: true }), null)
})

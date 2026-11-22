// The browser tab's title in the reader's language (owner, 2026-11-22: Rankings and every other page kept its English
// title). The server keeps each page's English title, for search engines and English readers; for the 12 other
// languages the page's own title is set in the browser (lib/doc-title.js, app/components/DocTitle.jsx).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LANGUAGES } from './i18n.js'
import { pageTitle, homeTitle, readerTitle } from './doc-title.js'

const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const CODES = LANGUAGES.map(l => l.code ?? l)
const PACKS = Object.fromEntries(await Promise.all(CODES.map(async l => [l, (await import(`./i18n/${l}.js`)).default])))

// [page file, its title key, how the server's template names its places]
const OWN = [
  ['app/leaderboard/layout.js', 'titleLeaderboard'],
  ['app/heatmap/layout.js', 'titleHeatmap'],
  ['app/planner/layout.js', 'titlePlanner'],
  ['app/aviation/page.js', 'titleAviation'],
  ['app/weather/page.js', 'titleCities'],
  ['app/mountains/page.js', 'titleMountains', { 'peaks.length': 'n' }],
  ['app/weather/[city]/page.js', 'titleCity', { name: 'city' }],
  ['app/mountains/[peak]/page.js', 'titleSummit', { 'peak.name': 'peak', 'peak.elev': 'elev' }],
  ['app/aviation/[icao]/page.js', 'titleAirport', { code: 'code', 'ap.name': 'name' }],
]
// pages titled with words every language already has: the footer's, the testers page's heading
const SHARED = [
  ['app/privacy/page.js', 'footerPrivacy'], ['app/terms/page.js', 'footerTerms'], ['app/impressum/page.js', 'footerImpressum'],
  ['app/press/page.js', 'footerPress'], ['app/support/page.js', 'footerSupport'], ['app/testers/page.js', 'testersTitle'],
]

test('a page title in the layout\'s form, the start page in its own, and none set for English readers', () => {
  assert.equal(pageTitle('de', 'titleLeaderboard'), `${PACKS.de.titleLeaderboard} · MetaBlend`)
  assert.match(pageTitle('de', 'titleSummit', { peak: 'Großglockner', elev: 3798 }), /^\S.*Großglockner.*3798.* · MetaBlend$/)
  assert.equal(homeTitle('de'), `MetaBlend · ${PACKS.de.landingMetaTitle}`) // as lib/landing.js titles /de
  assert.equal(readerTitle('en', 'x'), null) // the server's English title stays
  assert.equal(readerTitle('de', 'x'), 'x')
})

// source-match-ok: a page's server title is its metadata, which no render here produces; the key must say it in English
test('each page\'s English title key says exactly what its server title says, places as placeholders', () => {
  for (const [file, key, places = {}] of OWN) {
    const m = src(file).match(/title: (?:ap \? )?(['`])(.+?)\1/)
    assert.ok(m, `${file}: a title`)
    let server = m[2]
    for (const [expr, name] of Object.entries(places)) server = server.replace(`\${${expr}}`, `{${name}}`)
    assert.equal(PACKS.en[key], server, `${file}: ${key}`)
  }
})

test('every other language has its own title, with the same places', () => {
  const missing = []
  for (const [, key] of OWN) {
    const places = (PACKS.en[key].match(/\{\w+\}/g) ?? []).sort().join()
    for (const l of CODES.filter(c => c !== 'en')) {
      const v = PACKS[l][key]
      if (!v || v === PACKS.en[key]) missing.push(`${l} ${key}: not translated`)
      else if ((v.match(/\{\w+\}/g) ?? []).sort().join() !== places) missing.push(`${l} ${key}: places ${v}`)
    }
  }
  assert.deepEqual(missing, [])
})

// source-match-ok: the title is set in an effect a static render does not run; the walk reads the tabs' titles
test('every page that kept its English title sets the reader\'s, the start page and More through the same hook', () => {
  for (const [file, key] of [...OWN, ...SHARED]) assert.match(src(file), new RegExp(`<DocTitle k="${key}"`), file)
  assert.match(src('app/HomePage.jsx'), /useDocTitle\(readerTitle\(lang, homeTitle\(lang\)\)\)/)
  assert.match(src('app/more/MoreClient.jsx'), /useDocTitle\(readerTitle\(lang, moreTitle\(lang\)\)\)/)
  const hook = src('lib/doc-title.js')
  assert.match(hook, /useLayoutEffect\(\(\) => \{\n\s*if \(!title\) return/)
  assert.match(hook, /new MutationObserver\(keep\)/)
  assert.match(hook, /return \(\) => watch\.disconnect\(\)/)
})

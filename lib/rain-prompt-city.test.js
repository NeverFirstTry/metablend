// The rain prompt (owner, 2026-11-22): 1. it asks about rain, so "Turn on" switches on rain alerts only; storm, severe
// weather and heat stay as they are (off on a new phone) until turned on in the settings. 2. it names and registers
// the city that is open when the user taps, not the most viewed one. 3. going offline must not push it under the tab
// bar: the offline notice is said in the line under the place's name instead of a box above the page.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { promptSettings, promptWaits } from './push-ui.js'
import de from './i18n/de.js'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { DataAge } = await import('../app/components/RefreshClock.jsx')
const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Turn on saves the open city as home and rain alerts on, and nothing about storm, severe weather or heat', () => {
  // the server's settings update is a patch: a flag left out keeps its value, so a new phone keeps them off and a
  // phone that chose them in the settings keeps its choice
  assert.deepEqual(promptSettings('Graz', 'de', 'C'), { home_name: 'Graz', alert_rain: true, lang: 'de', unit: 'C' })
})

// source-match-ok: the prompt shows only in the app, after an effect a static render does not run; its wiring is read
test('the prompt names and registers the city that is open, given by the home page', () => {
  const prompt = src('app/components/push/PushPrompt.jsx')
  assert.match(prompt, /export default function PushPrompt\(\{ lang, unit, city = null[,} ]/)
  assert.match(prompt, /const place = city \|\| show\.city/)
  assert.match(prompt, /pushApi\('settings', \{ method: 'PUT', body: promptSettings\(place, lang, unit\) \}\)/)
  assert.match(prompt, /fill\(t\(lang, 'promptTitle'\), \{ city: place \}\)/)
  assert.doesNotMatch(prompt, /alert_storm|alert_severe|alert_heat/)
  // the forecast's own name, the one the views are counted under (bumpCityView(json.city ?? q))
  assert.match(src('app/HomePage.jsx'), /const prompt = <PushPrompt lang=\{lang\} unit=\{unit\} city=\{data\?\.city \?\? null\}[ />]/)
})

test('offline, the line under the name says so as a status, its text neutral and only its icon amber; online the age', () => {
  const at = new Date().toISOString()
  const off = render(h(DataAge, { generatedAt: at, lang: 'de', offline: true }))
  assert.match(off, new RegExp(de.offlineBanner))
  // gold marks only the answer, and the amber read as gold right above the temperature (owner, 2026-11-22): the text
  // in the neutral secondary colour of the age line, the warning amber on the wifi-off icon alone
  assert.match(off, /<span role="status" class="text-zinc-500"><svg[^>]*class="[^"]*text-\[var\(--warn\)\][^"]*"/)
  assert.equal(off.match(/var\(--warn\)/g)?.length, 1, 'the amber on the icon only')
  assert.doesNotMatch(off, new RegExp(de.updatedJustNow))
  const on = render(h(DataAge, { generatedAt: at, lang: 'de' }))
  assert.doesNotMatch(on, new RegExp(de.offlineBanner))
  assert.match(on, new RegExp(de.updatedJustNow))
})

// source-match-ok: where the notice stands is the page's markup; the walk measures the prompt against the tab bar
test('the home page has no offline box above the page any more: the line under the name carries it', () => {
  const home = src('app/HomePage.jsx')
  assert.doesNotMatch(home, /\{offline && data && \(/)
  // across both columns of the toolbar (the buttons' column is empty in its row): one line, nothing moves down
  assert.match(home, /\{\(generatedAt \|\| offline\) && <div className=\{stackActions \? 'mt-1' : 'col-span-2'\}><DataAge [^>]*offline=\{offline\}/)
})

// one line at 320 px, so going offline moves nothing in any language (owner, 2026-11-22). Measured with the walk:
// French, 47 characters, stays one line; Spanish (58), Portuguese (56), Japanese and Korean wrapped to two (+19 px).
// The width counts a Chinese, Japanese or Korean glyph as two.
test('the offline text fits one line at 320 px in every language: no wider than the French one', async () => {
  const { LANGUAGES } = await import('./i18n.js')
  const wide = c => /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]/.test(c)
  const width = s => [...s].reduce((n, c) => n + (wide(c) ? 2 : 1), 0)
  const over = []
  for (const l of LANGUAGES.map(x => x.code ?? x)) {
    const p = (await import(`./i18n/${l}.js`)).default
    if (width(p.offlineBanner) > 47) over.push(`${l} ${width(p.offlineBanner)}: ${p.offlineBanner}`)
  }
  assert.deepEqual(over, [])
})

// 5. with an official warning the prompt sat at the tab bar's edge, below the warnings card (owner, 2026-11-22): while
// the card lists a warning for the place the prompt waits for a visit without one; until the warnings are known it
// waits too, so it does not show and then vanish
test('the prompt waits while the warnings card lists a warning, and until the warnings are known', () => {
  const at = Date.parse('2026-11-22T18:00:00Z')
  const valid = { id: 'w', level: 3, onset: '2026-11-22T17:00:00Z', expires: '2026-11-23T01:00:00Z' }
  const over = { ...valid, expires: '2026-11-22T17:30:00Z' }
  assert.equal(promptWaits(true, undefined), true, 'not known yet')
  assert.equal(promptWaits(true, { warnings: [valid], at }), true, 'a warning the card lists')
  assert.equal(promptWaits(true, { warnings: [over], at }), false, 'only one that is over')
  assert.equal(promptWaits(true, { warnings: [], at }), false, 'none')
  assert.equal(promptWaits(true, null), false, 'no answer: the prompt is not held back by a failed request')
  assert.equal(promptWaits(false, undefined), false, 'no place: nothing to wait for')
})

// source-match-ok: the prompt shows only in the app after an effect; its wiring and the hook's three answers are read
test('the prompt asks the same warnings the card shows, with no second request', () => {
  const prompt = src('app/components/push/PushPrompt.jsx')
  assert.match(prompt, /export default function PushPrompt\(\{ lang, unit, city = null, lat = null, lon = null, cc = null \}\)/)
  assert.match(prompt, /const warned = useWarnings\(lat, lon, lang, cc\)/)
  assert.match(prompt, /if \(promptWaits\(lat != null, warned\)\) return null/)
  // the place and country the warnings card is given (TabToday: now.lat, now.lon, outlook?.cc): one shared answer
  assert.match(src('app/HomePage.jsx'), /<PushPrompt lang=\{lang\} unit=\{unit\} city=\{data\?\.city \?\? null\} lat=\{data\?\.lat\} lon=\{data\?\.lon\} cc=\{outlook\?\.cc\} \/>/)
  // undefined while loading, null for no answer, the warnings once there (the strip and the card only test truthiness)
  const hook = src('lib/warnings/useWarnings.js')
  assert.match(hook, /if \(!state \|\| state\.key !== key\) return undefined/)
  assert.match(hook, /return state\.d \? \{ \.\.\.state\.d, at: state\.at \} : null/)
})

// 4. the More page's browser title in the reader's language (owner, 2026-11-22: it stayed "More · MetaBlend" in German)
test('the More page titles its tab in all 13 languages, with the layout\'s " · MetaBlend"', async () => {
  const { moreTitle } = await import('../app/more/MoreClient.jsx')
  const { LANGUAGES } = await import('./i18n.js')
  assert.equal(moreTitle('de'), 'Mehr · MetaBlend')
  assert.equal(moreTitle('en'), 'More · MetaBlend')
  const codes = LANGUAGES.map(l => l.code ?? l)
  assert.equal(codes.length, 13)
  const titles = codes.map(moreTitle)
  assert.equal(new Set(titles).size, 13, `a title of its own in each language: ${titles.join(', ')}`)
  for (const s of titles) assert.match(s, /^\S.* · MetaBlend$/)
  // the page is static and says "More" in its metadata, which Next puts back after hydration: the client keeps the
  // reader's title while More is open and lets go in the commit that leaves it (the walk checks the next page's title)
  // source-match-ok: document.title is set in an effect a static render does not run
  // the keeping itself is the shared hook now (lib/doc-title.js, lib/page-titles.test.js); English keeps the server's
  assert.match(src('app/more/MoreClient.jsx'), /useDocTitle\(readerTitle\(lang, moreTitle\(lang\)\)\)/)
})

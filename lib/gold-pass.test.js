// X3, the gold pass (UX review 2026-11-20, owner: before the store run of 28 November). Gold has one job per screen,
// the main answer: the consensus temperature, the best day, the summit window, the favourable start, the source
// trusted most, the best months; a screen without an answer keeps gold for its one main button. Selected tabs,
// toggles and chips get a neutral highlight; section labels are grey; links are the text colour, underlined;
// caution text keeps the warning colour with an icon. The logo stays gold.
// The emerald classes are remapped by globals.css's theme blocks, which outweigh plain utilities: the central rules
// below decide what they render; the answers set the accent explicitly (text-[var(--accent)], var(--accent)).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { windowTone } from './hike/text.js'
import { headlineTone } from './outlook/text.js'

const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const css = src('app/globals.css')
// the two blocks of today's look: dark (:root:not([data-theme="light"])) and light (:root[data-theme="light"])
const blocks = () => {
  const darkStarts = [...css.matchAll(/^:root:not\(\[data-theme="light"\]\) \{$/gm)].map(m => m.index)
  const lightStarts = [...css.matchAll(/^:root\[data-theme="light"\] \{$/gm)].map(m => m.index)
  return [...darkStarts, ...lightStarts].map(i => css.slice(i, css.indexOf('\n}\n', i))).filter(b => /\.text-emerald-400/.test(b))
}

// source-match-ok: the theme blocks are style sheet rules; what they render is measured by the UX walk's laws-gold
test('the theme blocks render the emerald classes neutral: labels grey, links and buttons in the text colour', () => {
  const both = blocks()
  assert.equal(both.length, 2, 'the dark and the light block')
  for (const b of both) {
    assert.match(b, /& \.text-emerald-400, & \.text-emerald-400\\\/80 \{ color: var\(--muted\); \}/)
    assert.match(b, /& :is\(a, button\)\.text-emerald-400 \{ color: var\(--foreground\); \}/)
    assert.match(b, /& \.hover\\:text-emerald-400:hover \{ color: var\(--foreground\); \}/)
    assert.doesNotMatch(b, /\.text-emerald-400[^{]*\{ color: var\(--accent\)/, 'no emerald text in gold')
    assert.doesNotMatch(b, /border-emerald-400[^{]*\{ border-color: rgb\((255 217 138|150 100 0)/, 'no emerald border in gold')
  }
  assert.match(css, /a\.text-emerald-400:not\(\.inline-flex, \.flex, \.block\) \{ text-decoration-line: underline; text-underline-offset: 4px; \}/)
  // the website's tabs: the active one underlined in the text colour, not gold
  assert.match(css, /\[role="tab"\]\[aria-selected="true"\] \{ background: none; color: var\(--foreground\); font-weight: 600; box-shadow: inset 0 -2px 0 var\(--foreground\); \}/)
})

test('a summit window and the week\'s best day are the answer (gold); no window and a dry day are neutral', () => {
  assert.equal(windowTone({ window: { from: 'a', to: 'b', hours: 1 }, next: null }), 'answer')
  assert.equal(windowTone({ window: null, next: null }), 'neutral')
  assert.equal(windowTone({ window: { from: 'a', to: 'b', hours: 1 } }, { stormUnknown: true }), 'warn')
  assert.equal(headlineTone('d7', { code: 'best_day' }), 'answer')
  assert.equal(headlineTone('d7', { code: 'no_best_day' }), 'neutral')
  assert.equal(headlineTone('today', { code: 'dry' }), 'neutral')
  assert.equal(headlineTone('today', { code: 'rain_window' }), 'rain')
  const headline = src('app/components/outlook/Headline.jsx')
  assert.match(headline, /answer: \{ box: '[^']*var\(--accent\)[^']*', color: 'var\(--accent\)' \}/)
  assert.doesNotMatch(headline, /emerald/)
})

// source-match-ok: each answer's colour is its class or style; the walk's laws-gold counts what renders gold per screen
test('each screen sets its one answer in gold explicitly', () => {
  assert.match(src('app/components/outlook/NowLine.jsx'), /text-7xl[^"]*text-\[var\(--accent\)\]/, 'the consensus temperature')
  assert.match(src('app/weather/[city]/CityPage.jsx'), /text-6xl[^"]*text-\[var\(--accent\)\]/, 'the city page\'s temperature')
  const summit = src('app/mountains/[peak]/SummitPage.jsx')
  assert.match(summit, /todayGold = !!windows\[0\] && windowTone\(windows\[0\]\.w, \{ stormUnknown \}\) === 'answer'/, 'the summit page\'s window, when there is one')
  assert.match(summit, /todayGold \? ' text-\[var\(--accent\)\]' : ''/)
  const route = src('app/components/hike/RouteView.jsx')
  assert.match(route, /style=\{\{ color: 'var\(--accent\)' \}\}>\s*\{fill\(t\(lang, s\.start === s\.latest/, 'the favourable start')
  assert.match(route, /className="press text-sm text-\[var\(--accent\)\] underline underline-offset-4">/, 'or the next favourable day')
  const ranks = src('app/leaderboard/page.js')
  assert.match(ranks, /background: \(api\.weight \?\? 0\) === most \? 'var\(--accent\)' : 'var\(--muted\)'/, 'only the source trusted most')
  const planner = src('app/planner/page.js')
  assert.match(planner, /<span key=\{m\} className="[^"]*text-\[var\(--accent\)\][^"]*">/, 'the best months, as their chips say them')
  assert.match(planner, /best\.includes\(r\.month\) \? 'text-white font-bold'/, 'under the charts bold, not gold again')
  assert.doesNotMatch(planner, /barClass="bg-\[var\(--accent\)\]"/, 'the temperature bars are not gold')
  const peaks = src('app/components/hike/MyPeaks.jsx')
  assert.match(peaks, /answer=\{p\.id === first\}/, 'the next favourable window on a saved peak, one row only')
  // the forecast's line is its answer over the day; on a peak and in the week's days it is not
  assert.match(src('app/components/hike/PeakView.jsx'), /<HourlyChart [^>]*line="var\(--muted\)"/)
  assert.match(src('app/components/outlook/Tab7d.jsx'), /<HourlyChart [^>]*line="var\(--muted\)"/)
})

// source-match-ok: selected states and the logo are classes in the components
test('selected tabs, chips and toggles are neutral; the logo stays gold', () => {
  assert.doesNotMatch(src('app/components/AppChrome.jsx'), /activeTab === href \? 'text-emerald-400'/)
  const route = src('app/components/hike/RouteView.jsx')
  assert.doesNotMatch(route, /date === x \? 'bg-emerald-400/)
  assert.doesNotMatch(route, /pace === p \? 'bg-zinc-900 text-emerald-400'/)
  const ranks = src('app/leaderboard/page.js')
  assert.doesNotMatch(ranks, /\? 'bg-emerald-400 text-black/)
  assert.doesNotMatch(src('app/HomePage.jsx'), /compareMode \? 'bg-emerald-400/)
  for (const f of ['app/HomePage.jsx', 'app/components/ProblemScreen.jsx', 'app/components/SiteHeader.jsx', 'app/components/TermsNotice.jsx', 'app/widget/[city]/Widget.jsx']) {
    assert.doesNotMatch(src(f), /Meta<span className="text-emerald-400">Blend/, f)
    assert.match(src(f), /Meta<span className="text-\[var\(--accent\)\]">Blend/, `${f}: the logo`)
  }
})

// source-match-ok: the caution paragraph's look is its markup
test('the caution paragraph keeps the warning colour and gets its icon, so it does not read as gold', () => {
  assert.match(src('app/components/hike/HikeNotes.jsx'), /<AlertTriangle [^>]*aria-hidden/)
})

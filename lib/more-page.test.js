// The More tab (UX review E1 and E3, owner: before launch). E1: "Explore" was one list of four tools, three
// legal pages and feedback, and "Planner" and "Aviation" did not say what they are; now three groups, each tool
// with a line. E3: eleven app icons stood above the notification settings; now notifications come right after
// the three pickers and the icon grid last. The pickers' selection is neutral (the gold rule of 2026-11-20).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { default: MoreClient } = await import('../app/more/MoreClient.jsx')
const en = (await import('./i18n/en.js')).default
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']
const KEYS = ['moreTools', 'moreHelp', 'moreLegal', 'toolLineRankings', 'toolLineHeatmap', 'toolLinePlanner', 'toolLineAviation']

test('E1: three groups in order, each tool with its line, Support under help, the legal pages last', () => {
  const html = render(h(MoreClient))
  const at = s => html.indexOf(s)
  assert.ok(at(en.moreTools) > 0 && at(en.moreTools) < at(en.moreHelp) && at(en.moreHelp) < at(en.moreLegal), 'Tools, Help, Legal')
  for (const k of ['toolLineRankings', 'toolLineHeatmap', 'toolLinePlanner', 'toolLineAviation']) assert.ok(html.includes(en[k]), k)
  assert.ok(at('href="/support"') > at(en.moreHelp) && at('href="/support"') < at(en.moreLegal), 'Support under Help')
  assert.ok(at('href="/privacy"') > at(en.moreLegal), 'Privacy under Legal')
  assert.ok(!html.includes('>Explore<'), 'no single Explore list (the key moreLinks is gone)')
})

test('the pickers mark the choice neutrally, not in gold', () => {
  const html = render(h(MoreClient))
  const pressed = html.match(/<button[^>]*aria-pressed="true"[^>]*class="([^"]*)"/)?.[1] ?? html.match(/<button[^>]*class="([^"]*)"[^>]*aria-pressed="true"/)?.[1]
  assert.ok(pressed, 'a chosen picker')
  assert.doesNotMatch(pressed, /emerald/)
})

// source-match-ok: the icon grid and the notification settings render only in the native app (isNative after mount)
test('E3: notifications right after the settings, the icon grid after the links', () => {
  const src = readFileSync(new URL('../app/more/MoreClient.jsx', import.meta.url), 'utf8')
  const notif = src.indexOf('<NotificationSettings'), icons = src.indexOf('<AppIconPicker'), tools = src.indexOf("t(lang, 'moreTools')")
  assert.ok(notif > 0 && notif < tools && tools < icons)
})

test('the new texts in every language', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.deepEqual(KEYS.filter(k => !p[k]), [], l)
  }
})

// The rain prompt (UX review S4, owner: before launch): "Get a heads-up before rain in Vienna? Turn on" stood
// two screens down, between the rain radar and the sources, and its close button was named "×". It now stands
// right under the headline card of the tab on screen, and its close button says "Not now".
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { tempFormatter, deltaFormatter, spanFormatter } = await import('./outlook/text.js')
const outlook = JSON.parse(readFileSync(new URL('./__fixtures__/outlook-vienna.json', import.meta.url), 'utf8'))
const fmt = { fmtTemp: tempFormatter('C'), fmtDelta: deltaFormatter('C'), fmtSpan: spanFormatter('C') }
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

test('each tab puts what it is given right after its headline', async () => {
  const marker = h('p', { id: 'the-prompt' }, 'prompt')
  for (const name of ['TabToday', 'TabTomorrow', 'Tab7d']) {
    const { default: Tab } = await import(`../app/components/outlook/${name}.jsx`)
    const html = render(h(Tab, { outlook, now: { lat: 48.2, lon: 16.37, sources: [], consensus: {} }, unit: 'C', lang: 'en', fmt, prompt: marker }))
    const head = html.search(/<div[^>]*role="status"|<h2|class="[^"]*headline/), at = html.indexOf('id="the-prompt"')
    assert.ok(at > 0, `${name} renders it`)
    // nothing but the headline before it: no chart, no hour strip, no week list
    assert.ok(!/<svg[^>]*role="img"|aria-expanded/.test(html.slice(0, at)), `${name}: right after the headline`)
    assert.ok(head < at)
  }
})

// source-match-ok: the prompt needs the phone's bridge and three city views before it shows, which a static render cannot give
test('the start page hands the prompt to the tab, and its close button says Not now', () => {
  const home = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')
  assert.match(home, /const prompt = <PushPrompt lang=\{lang\} unit=\{unit\} \/>/)
  assert.equal((home.match(/prompt=\{prompt\}/g) ?? []).length, 3)
  const card = readFileSync(new URL('../app/components/push/PushPrompt.jsx', import.meta.url), 'utf8')
  assert.match(card, /aria-label=\{t\(lang, 'promptNotNow'\)\}/)
  assert.doesNotMatch(card, /aria-label="×"/)
})

test('"Not now" in every language', async () => {
  for (const l of LANGS) assert.ok((await import(`./i18n/${l}.js`)).default.promptNotNow, l)
})

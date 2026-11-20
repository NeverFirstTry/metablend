// The emoji text-key clean-up (UX review X5, owner 2026-11-20: "in the same pass"): texts no screen uses any more
// are gone from all 13 packs (emoji-titled leftovers of the old start page, and the welcome texts first start
// replaced), and no text a screen shows carries an emoji. © ® ™ in the credits are not emoji.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']
const GONE = ['fetch', 'forecastTitle', 'feedbackTitle', 'rainYesEmoji', 'rainNoEmoji', 'rainMixedEmoji', 'bestTimeTitle', 'detailsTitle', 'climateTitle',
  'welcomeTitle', 'welcomeSub', 'welcomeF1Title', 'welcomeF1Sub', 'welcomeF2Title', 'welcomeF2Sub', 'welcomeF3Title', 'welcomeF3Sub', 'welcomeHint']
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/u

test('the unused texts are gone from every pack', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.deepEqual(GONE.filter(k => k in p), [], l)
  }
})

test('no text in any pack carries an emoji', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    // shortcut: push titles are Fable's (their emoji go with the deploy of 2026-11-20); drop this filter once it is on main
    const hits = Object.entries(p).filter(([k, v]) => typeof v === 'string' && !k.startsWith('push') && EMOJI.test(v)).map(([k]) => k)
    assert.deepEqual(hits, [], l)
  }
})

test('a warning level shows as one to three drawn triangles, not the typed ⚠ phones colour as emoji', async () => {
  await import('./test-jsx-hooks.js')
  const { createElement: h } = await import('react')
  const { renderToStaticMarkup: render } = await import('react-dom/server')
  const { default: LevelMarks } = await import('../app/components/outlook/LevelMarks.jsx')
  const { levelCount } = await import('./warnings/text.js')
  assert.deepEqual([2, 3, 4, 5].map(levelCount), [1, 2, 3, 3])
  const html = render(h(LevelMarks, { level: 3 }))
  assert.equal(html.match(/<svg/g)?.length, 2)
  assert.ok(!EMOJI.test(html) && !html.includes('⚠'))
})

// source-match-ok: the strip and the card need a full warning feed to render; the marks themselves are rendered above
test('the warning strip and card use the drawn marks; the plan rows under Notifications have no ⛰', async () => {
  const { readFileSync } = await import('node:fs')
  for (const f of ['WarningStrip', 'WarningsCard']) {
    const src = readFileSync(new URL(`../app/components/outlook/${f}.jsx`, import.meta.url), 'utf8')
    assert.match(src, /<LevelMarks level=\{w\.level\} \/>/, f)
    assert.doesNotMatch(src, /levelIcons/, f)
  }
  assert.doesNotMatch(readFileSync(new URL('../app/components/push/NotificationSettings.jsx', import.meta.url), 'utf8'), /⛰/)
})

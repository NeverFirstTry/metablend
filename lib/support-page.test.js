// /support, the App Store support URL, rendered in every language: a way to reach us (Apple asks for it),
// five answers, the legal pages, and the in-app places named with the app's own labels.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { LANGUAGES, t } = await import('./i18n.js')
const { SupportBody } = await import('../app/support/SupportContent.jsx')

test('the support page in every language: email, five questions, legal links, app labels filled in', () => {
  for (const { code } of LANGUAGES) {
    const html = render(h(SupportBody, { lang: code }))
    assert.match(html, /href="mailto:info@metablend\.app"/, code)
    assert.equal(html.match(/<h3/g)?.length, 5, `${code}: five questions`)
    for (const href of ['/privacy', '/terms', '/impressum', '/terms#disclaimer']) assert.ok(html.includes(`href="${href}"`), `${code}: ${href}`)
    assert.doesNotMatch(html, /\{path\}/, `${code}: a placeholder left`)
    for (const key of ['more', 'feedbackSend', 'notifTitle']) assert.ok(html.includes(t(code, key).replaceAll('&', '&amp;')), `${code}: ${key} label`)
  }
})

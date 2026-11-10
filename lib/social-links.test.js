// MetaBlend's profiles (Instagram, TikTok, X) as plain links in the website footer, on /support and in the
// app's More tab, rendered for real: each a link that opens outside with no referrer, the mark drawn inline,
// and nothing from the networks on the page (no script, iframe or embed).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { SOCIAL } = await import('../app/components/SocialLinks.jsx')
const { default: Footer } = await import('../app/components/Footer.jsx')
const { SupportBody } = await import('../app/support/SupportContent.jsx')
const { default: MoreClient } = await import('../app/more/MoreClient.jsx')

test('the three profiles are plain links in the footer, on /support and in the More tab', () => {
  assert.deepEqual(SOCIAL.map(([, href]) => href), ['https://www.instagram.com/metablend.app/', 'https://www.tiktok.com/@metablend.app', 'https://x.com/MetaBlendapp'])
  for (const [where, html] of [['footer', render(h(Footer, { lang: 'de' }))], ['/support', render(h(SupportBody, { lang: 'de' }))], ['More tab', render(h(MoreClient, {}))]]) {
    for (const [name, href] of SOCIAL) {
      const a = html.match(new RegExp(`<a href="${href.replace(/[.?]/g, '\\$&')}"[^>]*>`))?.[0]
      assert.ok(a, `${where}: ${name} link`)
      assert.match(a, /target="_blank"/, `${where}: ${name} opens outside`)
      assert.match(a, /rel="noopener noreferrer"/, `${where}: ${name} without referrer`)
    }
    assert.doesNotMatch(html, /<(script|iframe|embed|object)\b|instagram\.com\/embed|platform\.twitter|tiktok\.com\/embed/i, `${where}: nothing from the networks`)
  }
})

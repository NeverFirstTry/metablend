// 2026-11-10: the live home page showed two headers. The host had rendered the home page again under
// its own name for it, "/index"; the layout's header, which stays away on "/", did not recognise it.
// The header is rendered for real here, on each address a page can believe it has.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { pagePath } = await import('./page-path.js') // after the hooks: it imports next/navigation
const { createElement: h } = await import('react')
const { renderToStaticMarkup: render } = await import('react-dom/server')
const { PageHeader } = await import('../app/components/SiteHeader.jsx')
const headerOn = path => { globalThis.__testPathname = path; try { return render(h(PageHeader)) } finally { delete globalThis.__testPathname } }

test('pagePath — "/index" is the home page; every other address is itself', () => {
  assert.equal(pagePath('/index'), '/')
  assert.equal(pagePath('/'), '/')
  assert.equal(pagePath('/planner'), '/planner')
  assert.equal(pagePath('/indexes'), '/indexes')
})

test('the layout\'s header stays away on the home page, also when the page believes it is "/index"', () => {
  assert.equal(headerOn('/'), '')
  assert.equal(headerOn('/index'), '', 'this address gave the home page a second header')
  assert.equal(headerOn('/de'), '', 'a language start page has its own')
  assert.match(headerOn('/planner'), /<header class="site-header/)
  assert.match(headerOn('/weather/vienna'), /<header class="site-header/)
})

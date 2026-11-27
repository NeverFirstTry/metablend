// The website header's nav names the testers page after Aviation until the app is in both stores (owner, 2026-11-27:
// the link stood only at the very bottom of the start page and beside the store badges on hiking). Same check as
// the start page's bottom link: !(STORES.ios && STORES.android). Neutral like the other nav items, never gold.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { siteNav } = await import('../app/components/SiteHeader.jsx')

test('the testers page comes last in the nav until both stores are live', () => {
  const hrefs = stores => siteNav(stores).map(([href]) => href)
  assert.deepEqual(hrefs({}), ['/leaderboard', '/heatmap', '/planner', '/hike', '/aviation', '/testers'])
  assert.equal(siteNav({}).at(-1)[1], 'testersBecome')
  assert.ok(hrefs({ android: 'p' }).includes('/testers'), 'one store only: still testing')
  assert.ok(hrefs({ ios: 'a' }).includes('/testers'))
  assert.ok(!hrefs({ ios: 'a', android: 'p' }).includes('/testers'), 'both live: gone')
})

// source-match-ok: the nav item's look is its class, the same one line for every item
test('every nav item, the testers link too, has the same neutral class: no gold', () => {
  const src = readFileSync(new URL('../app/components/SiteHeader.jsx', import.meta.url), 'utf8')
  assert.match(src, /const NAV = siteNav\(STORES\)/)
  assert.match(src, /\{NAV\.map\(\(\[href, key\]\) => <Link [^\n]*?className="min-h-11 lg:min-h-0 inline-flex items-center text-zinc-400 hover:text-emerald-400 transition-colors">/)
  assert.doesNotMatch(src, /var\(--accent\)[^\n]*testers|testers[^\n]*var\(--accent\)/)
})

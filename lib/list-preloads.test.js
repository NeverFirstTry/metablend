// A link list to stored pages must not preload them. Next preloads every linked page that scrolls into
// view, and a preload of a stored page past its storage time rebuilds it: a summit page's rebuild asks
// Open-Meteo. On 2026-11-16 one visit of the summit list set off about 90 rebuilds within seconds,
// Open-Meteo refused 43 of them and /api/health answered 503 for 16 minutes. With prefetch={false} a
// page is asked when its link is opened, not when it is seen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const APP = fileURLToPath(new URL('../app/', import.meta.url))
// a link built from a variable into the three families of stored pages: one entry of a list
const toStoredPage = /href=\{`\/(mountains|weather|aviation)\/\$\{/

test('no link list preloads the stored pages it links to', () => {
  // source-match-ok: a preload happens only in a browser scrolling the list, the markup shows nothing of it
  let found = 0
  for (const file of readdirSync(APP, { recursive: true }).filter(f => /\.jsx?$/.test(f))) {
    const links = (readFileSync(join(APP, file), 'utf8').match(/<Link\b[^>]*>/g) ?? []).filter(tag => toStoredPage.test(tag))
    found += links.length
    for (const tag of links) assert.ok(tag.includes('prefetch={false}'), `app/${file} preloads: ${tag.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
  // the lists of summits, cities and airports, and the "more in this region" and "other cities" lists
  assert.ok(found >= 5, `only ${found} list links found: the pattern no longer matches the lists`)
})

// The hiking page's teaser reads a stored summit forecast from our own API, like the summit pages do.
// Run locally on another port than 3000 it asked port 3000 all the same (it did not read SELF_BASE), so
// a local check never saw the teaser's window: it showed "The live summit forecast is taking a break"
// (found 2026-11-17, while checking the teaser by hand). Both pages must ask the same address.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const base = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').match(/^const BASE = (.+?\))/m)?.[1]

test('the hiking page asks our own API at the same address as the summit pages, SELF_BASE first', () => {
  // source-match-ok: the page reads the request's headers and cookies, which no test here can give it
  const summit = base('app/mountains/[peak]/page.js')
  assert.match(summit, /process\.env\.SELF_BASE \?\?/)
  assert.equal(base('app/hike/page.js'), summit)
})

// Clock text on the start page. The page is rendered on the server and cached (up to an
// hour), so the browser's first render reads a later clock. Text that differs made React's
// hydration fail and rebuild the page, which dropped the theme and app marks the boot
// scripts set before first paint: light-mode visitors got dark (2026-11-08). Clock text
// carries suppressHydrationWarning, and the next tick shows the right value.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('the data age and the footer year may differ between the cached page and the browser', () => {
  assert.match(read('app/components/RefreshClock.jsx'), /<span className="text-zinc-500" suppressHydrationWarning>\{ageMin/)
  assert.match(read('app/components/Footer.jsx'), /suppressHydrationWarning>© \{new Date\(\)\.getFullYear\(\)\}/)
})

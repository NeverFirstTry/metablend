// Clock text on the start page. The page is rendered on the server and cached (up to an
// hour), so the browser's first render reads a later clock. Text that differs made React's
// hydration fail and rebuild the page, which dropped the theme and app marks the boot
// scripts set before first paint: light-mode visitors got dark (2026-11-08). Clock text
// carries suppressHydrationWarning, and the next tick shows the right value.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('the data age may differ between the cached page and the browser', () => {
  // source-match-ok: suppressHydrationWarning only acts while a browser hydrates, which these tests cannot run
  assert.match(read('app/components/RefreshClock.jsx'), /<span className="text-zinc-500" suppressHydrationWarning>\{ageMin/)
  // the footer's year was clock text too until 2026-11-10; it is the LICENSE file's fixed year now
  assert.doesNotMatch(read('app/components/Footer.jsx'), /getFullYear|Date\(/)
})

// After a failed hydration React rebuilds the page and clears every attribute on <html>
// it did not render, the boot scripts' marks among them. The app chrome and the theme
// put theirs back from what the boot kept and from the cookie, so the tab bar and the
// light theme survive a mismatch that slips through (lib/first-render.test.js guards
// the start page against one).
test('the app mark and the theme are put back after hydration', () => {
  // source-match-ok: layout-effect wiring needs a DOM; restoreAppMark itself is tested in app-client.test.js
  assert.match(read('app/components/AppChrome.jsx'), /useLayoutEffect\(\(\) => \{ restoreAppMark\(document\.documentElement, window\.__mbBoot\) \}, \[\]\)/)
  assert.match(read('app/components/ThemeSync.jsx'), /useLayoutEffect\(\(\) => \{ applyTheme\(readThemePref\(getCookie\(THEME_COOKIE\)\)\) \}, \[\]\)/)
})

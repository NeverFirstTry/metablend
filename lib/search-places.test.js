// The search area (UX review R2 to R5, owner: before launch). R2: saved and recent places took 250 px and pushed
// the forecast down; now one row that scrolls sideways, saved first. R5: saved chips were 30 px against 44 for
// recent ones and could not be removed; now the same chip with an ×. R3: the field kept what was typed while the
// title showed the forecast's name; now it takes the title's name. R4: no word when nothing matched; now a row in
// the suggestions, and "Try a city" under the not-found box.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { placeChips } from './recent-places.js'

const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']
const home = readFileSync(new URL('../app/HomePage.jsx', import.meta.url), 'utf8')

test('one row: saved places first, then recent ones, each place once', () => {
  assert.deepEqual(placeChips(['Lienz', 'Wien'], ['wien', 'Graz', 'Lienz', 'Linz']), [
    { city: 'Lienz', saved: true }, { city: 'Wien', saved: true }, { city: 'Graz', saved: false }, { city: 'Linz', saved: false },
  ])
  assert.deepEqual(placeChips([], []), [])
  assert.deepEqual(placeChips(null, ['Graz']), [{ city: 'Graz', saved: false }])
})

// source-match-ok: the row fills from the phone's storage and cookies in effects, which a static render never runs
test('R2 and R5: one sideways row of chips of one kind, a saved one removable', () => {
  assert.match(home, /placeChips\(favorites, recent\)\.map/)
  assert.match(home, /className="places-row flex gap-2 overflow-x-auto/)
  assert.match(home, /aria-label=\{fill\(t\(lang, 'savedRemove'\), \{ city: hans\(c\.city\) \}\)\}/)
  assert.doesNotMatch(home, /bg-amber-900\/20 border border-amber-500\/30 rounded-full px-3 py-1/)
})

// source-match-ok: the field and the suggestions answer typing and loads, which a static render cannot drive
test('R3 and R4: the field takes the title\'s name; nothing found is said, and places to try follow the box', () => {
  assert.match(home, /const shownName = hans\(json\.cityShown \?\? json\.city\)/)
  assert.match(home, /t\(lang, 'searchNoPlace'\)/)
  assert.match(home, /errorRetry\?\.notFound && /)
})

test('the new texts in every language', async () => {
  for (const l of LANGS) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.ok(p.searchNoPlace && p.savedRemove?.includes('{city}') && p.placesRow, l)
  }
})

// The notification settings (UX review E4, owner: before launch): the switches were green checkboxes (green is
// the status colour, and by the gold rule a toggle is neutral), and "Home city" showed a dash, "Change" and an
// empty field with no hint. Now neutral switches in 44 px rows, and without a home city the field shows at once,
// with a hint.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../app/components/push/NotificationSettings.jsx', import.meta.url), 'utf8')
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

// source-match-ok: the settings render only after the phone's bridge answered (an effect), which a static render never runs
test('the switches are neutral and their rows 44 px', () => {
  assert.doesNotMatch(src, /accent-emerald-400/)
  assert.equal((src.match(/accent-\[var\(--foreground\)\]/g) ?? []).length, 2)
  assert.equal((src.match(/<label (key={key} )?className="flex min-h-11 items-center justify-between/g) ?? []).length, 2)
})

// source-match-ok: as above
test('home city: no dash; without one the field shows at once, with a hint and a name for screen readers', () => {
  assert.doesNotMatch(src, /: '–'\}/)
  assert.match(src, /\{\(editHome \|\| !s\.home_name\) && \(/)
  assert.match(src, /placeholder=\{t\(lang, 'notifHomeSearch'\)\} aria-label=\{t\(lang, 'notifHomeSearch'\)\}/)
})

test('the hint in every language', async () => {
  for (const l of LANGS) assert.ok((await import(`./i18n/${l}.js`)).default.notifHomeSearch, l)
})

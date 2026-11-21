// Notifications are asked for after saying what they bring (UX review 2026-11-20, E2; owner: before
// submission on 3 Dec): before they are on, under the button, the list of what can come and that the user
// chooses, then the quiet-hours line. The off state needs the phone's bridge, so this reads the code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LANGUAGES } from './i18n.js'

const src = readFileSync(new URL('../app/components/push/NotificationSettings.jsx', import.meta.url), 'utf8')

test('before they are on: the button, then what comes, then the quiet hours', () => {
  const button = src.indexOf("t(lang, 'notifEnable')"), what = src.indexOf("t(lang, 'notifWhat')"), rules = src.indexOf("t(lang, 'notifRules')")
  assert.ok(button > 0 && what > button && rules > what, 'notifEnable, notifWhat, notifRules in that order')
})

test('the list names every kind of alert the settings offer, in all 13 languages', async () => {
  for (const { code } of LANGUAGES) {
    const { default: p } = await import(`./i18n/${code}.js`)
    assert.ok(p.notifWhat, `${code}.notifWhat`)
    assert.ok(!/[–—]/.test(p.notifWhat), `${code}: no dash`)
    // the first three alert names stand in it as the settings name them (case aside)
    for (const k of ['notifStorm', 'notifSevere', 'notifHeat']) assert.ok(p.notifWhat.toLowerCase().includes(p[k].toLowerCase()), `${code}: ${k} "${p[k]}"`)
  }
})

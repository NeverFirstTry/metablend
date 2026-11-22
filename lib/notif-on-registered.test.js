// Notifications show as on only once the server has taken the phone (owner, 2026-11-22: "the notification
// settings show 'on' only after the server accepted the registration; otherwise a translated message and the switch
// stays off"). The A52 build lacked google-services.json, so Android gave no push token and the registration never
// reached the server. The settings screen already drew its switch from the server's answer; the rain prompt, the other
// way to turn them on, went away without a word when that failed and never asked again.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { turnOnOutcome } from './push-ui.js'

test('turnOnOutcome: done only when the server took the phone; a refused permission and a failure are told apart', () => {
  assert.equal(turnOnOutcome({ ok: true }), 'done')
  assert.equal(turnOnOutcome({ ok: false, reason: 'denied' }), 'denied')
  assert.equal(turnOnOutcome({ ok: false, reason: 'error', detail: 'no push token after 15 s' }), 'error')
  assert.equal(turnOnOutcome({ ok: false, reason: 'error', detail: 'server 429: Too many new phones' }), 'error')
  assert.equal(turnOnOutcome(null), 'error')
})

// source-match-ok: client components that need the native push plugin; the outcome is tested above
test('the rain prompt: a failed turn-on says so in the reader\'s language and stays, a refused one goes', () => {
  const src = readFileSync(new URL('../app/components/push/PushPrompt.jsx', import.meta.url), 'utf8')
  assert.match(src, /turnOnOutcome\(await enablePush\(/)
  // only a refused permission dismisses the prompt for good; a failure keeps it, with the translated message
  assert.match(src, /if \(outcome === 'denied'\) \{ await dismissPrompt\(\); setShow\(null\); return \}/)
  assert.match(src, /t\(lang, 'notifError'\)/)
  assert.doesNotMatch(src, /detail/, 'no error text of the phone or the server on screen')
})

// source-match-ok: the switch's state is the server's answer; rendering needs the native plugins
test('the settings screen: the on switch stands only with the server\'s settings, and a failed turn-on leaves it off', () => {
  const src = readFileSync(new URL('../app/components/push/NotificationSettings.jsx', import.meta.url), 'utf8')
  // settings come only from the server's 200 (GET settings or PUT settings)
  assert.match(src, /settings: r\.status === 200 \? r\.json\.settings : null/)
  // without them the screen shows Turn on; the checked switch is in the other branch
  const off = src.indexOf(') : !s ? ('), on = src.indexOf('checked onChange={() => { haptic(\'selection\'); turnOff() }}')
  assert.ok(off > 0 && on > off, 'the on switch only where the server answered with settings')
  // a failed turn-on: the translated message, then the screen reads the server again (still off)
  assert.match(src, /if \(!r\.ok\) \{[^\n]*setMsg\(r\.reason === 'denied' \? null : t\(lang, 'notifError'\)\); await load\(\); return \}/)
})

test('the device checklist: a new worktree or clone needs google-services.json before an Android build', () => {
  const readme = readFileSync(new URL('../mobile/README.md', import.meta.url), 'utf8')
  const list = readme.slice(readme.indexOf('## Device checklist'), readme.indexOf('\n## ', readme.indexOf('## Device checklist') + 5))
  assert.match(list, /new worktree or clone[\s\S]*google-services\.json[\s\S]*mobile\/android\/app\//)
})

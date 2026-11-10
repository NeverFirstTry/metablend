// The terms notice on the app's first start (2026-11-10): when it is due, what the phone keeps, what
// the boot script marks before first paint, and the notice's texts in the 13 languages. The German is
// the original and is pinned word for word; the terms are accepted, the privacy notice is only
// pointed to (its basis is legitimate interest, nobody agrees to it).
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TERMS_VERSION, TERMS_KEY, termsDue, termsChanged, passedVersion, keepPassed, linkedParts } from './terms.js'
import { APP_BOOT_SCRIPT } from './app-client.js'
import { LANGUAGES, loadLanguage, t } from './i18n.js'

test('termsDue — due until this version of the terms is passed; never on the pages the notice links to', () => {
  assert.match(TERMS_VERSION, /^20\d\d-\d\d-\d\d$/)
  assert.equal(termsDue(null, '/'), true, 'a first start')
  assert.equal(termsDue('2026-01-01', '/hike'), true, 'an earlier version was passed')
  assert.equal(termsDue(TERMS_VERSION, '/'), false)
  for (const path of ['/terms', '/privacy', '/impressum', '/terms/']) assert.equal(termsDue(null, path), false, path)
  assert.equal(termsDue(null, '/termsandmore'), true)
  assert.equal(termsChanged(null), false, 'a first start is not a change')
  assert.equal(termsChanged('2026-01-01'), true)
  assert.equal(termsChanged(TERMS_VERSION), false)
})

test('the phone keeps the version it passed the notice for; storage that is off counts as nothing kept', () => {
  const kept = new Map()
  const storage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) }
  assert.equal(passedVersion(storage), null)
  assert.equal(keepPassed(storage), true)
  assert.deepEqual([...kept], [[TERMS_KEY, TERMS_VERSION]])
  assert.equal(termsDue(passedVersion(storage), '/'), false)
  const off = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
  assert.equal(passedVersion(off), null)
  assert.equal(keepPassed(off), false)
})

// Runs the layout's boot script against a fake page: what it leaves on <html>.
function boot({ app = true, path = '/', stored = null, blocked = false } = {}) {
  const html = { dataset: {}, style: { fontSize: '' } }
  const win = {}
  win.top = win; win.self = win
  const localStorage = { getItem: k => { if (blocked) throw new Error('blocked'); return k === TERMS_KEY ? stored : null } }
  new Function('window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', APP_BOOT_SCRIPT)(
    win, { cookie: '', documentElement: html }, { userAgent: app ? 'Mozilla/5.0 (Linux; Android 15) MetaBlendApp' : 'Mozilla/5.0' }, { search: '', pathname: path }, localStorage, { getItem: () => null })
  return html.dataset
}

test('the boot script marks the app before first paint while the notice is due, and nothing else', () => {
  assert.equal(boot().termsDue, '1', 'first start in the app')
  assert.equal(boot({ stored: '2026-01-01' }).termsDue, '1', 'the terms changed since')
  assert.equal(boot({ stored: TERMS_VERSION }).termsDue, undefined)
  assert.equal(boot({ path: '/terms' }).termsDue, undefined, 'the terms stay readable')
  assert.equal(boot({ path: '/privacy' }).termsDue, undefined)
  assert.equal(boot({ app: false }).termsDue, undefined, 'the website has no such notice')
  const blocked = boot({ blocked: true })
  assert.equal(blocked.termsDue, undefined, 'storage off: the notice decides after it has loaded')
  assert.equal(blocked.app, '1', 'and the rest of the boot is not disturbed')
})

test('linkedParts — the link is the part in square brackets', () => {
  assert.deepEqual(linkedParts('You accept the [Terms of Use].'), ['You accept the ', 'Terms of Use', '.'])
  assert.deepEqual(linkedParts('[Polityka] wyjaśnia.'), ['', 'Polityka', ' wyjaśnia.'])
  assert.deepEqual(linkedParts('no link here'), ['no link here', '', ''])
})

test('the German notice, word for word: the terms are accepted with the button, the privacy notice is pointed to', async () => {
  await loadLanguage('de')
  assert.equal(t('de', 'termsNoticeAccept'), 'Mit „Weiter“ akzeptierst du die [Nutzungsbedingungen].')
  assert.equal(t('de', 'termsNoticePrivacy'), 'Wie wir mit Daten umgehen, steht in der [Datenschutzerklärung].')
  assert.equal(t('de', 'termsNoticeChanged'), 'Die Nutzungsbedingungen haben sich geändert.')
  assert.equal(t('de', 'termsNoticeContinue'), 'Weiter')
})

test('every language: both sentences carry exactly one link, the button and the change line none', async () => {
  for (const { code } of LANGUAGES) {
    await loadLanguage(code)
    for (const key of ['termsNoticeAccept', 'termsNoticePrivacy']) {
      const [before, label, after] = linkedParts(t(code, key))
      assert.ok(label, `${code} ${key}: a link in square brackets`)
      assert.ok((before + after).trim().length > 3, `${code} ${key}: a sentence around the link`)
      assert.doesNotMatch(before + label + after, /[[\]]/, `${code} ${key}: one pair of brackets only`)
    }
    for (const key of ['termsNoticeChanged', 'termsNoticeContinue']) {
      assert.ok(t(code, key).length > 1, `${code} ${key}`)
      assert.doesNotMatch(t(code, key), /[[\]]/, `${code} ${key}`)
    }
    assert.ok(t(code, 'termsNoticeAccept').includes(t(code, 'termsNoticeContinue')), `${code}: the sentence names the button by its own word`)
    if (code !== 'en') assert.notEqual(t(code, 'termsNoticeAccept'), t('en', 'termsNoticeAccept'), `${code}: translated`)
  }
})

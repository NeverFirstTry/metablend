import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSignup, testersCsv, parseAdminAction, SIGNUP_LANGS, MAX_TEXT } from './testers-signup.js'
import { LANGUAGES } from './i18n.js'

const ok = body => {
  const r = parseSignup(body)
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.value
}
const bad = (body, field) => {
  const r = parseSignup(body)
  assert.equal(r.ok, false, JSON.stringify(body))
  assert.equal(r.status, 400)
  if (field) assert.equal(r.field, field)
}

test('parseSignup — the address is trimmed and lower-cased; optional fields empty → null; language kept', () => {
  assert.deepEqual(ok({ email: '  Anna.Muster@GMAIL.com ', consent: true, lang: 'de' }), {
    email: 'anna.muster@gmail.com', phone_model: null, country: null, language: 'de', spam: false,
  })
  assert.deepEqual(ok({ email: 'a1@gmail.com', consent: true, phone: ' Pixel 8 ', country: ' Austria ', website: '' }), {
    email: 'a1@gmail.com', phone_model: 'Pixel 8', country: 'Austria', language: 'en', spam: false,
  })
  assert.equal(ok({ email: 'x@example.co.uk', consent: true, phone: '   ' }).phone_model, null)
  assert.equal(ok({ email: 'b@gmail.com', consent: true, lang: 'xx' }).language, 'en')
})

test('parseSignup — only real email addresses', () => {
  for (const email of [
    '', 'anna', 'anna@', '@gmail.com', 'anna@gmail', 'an na@gmail.com', 'anna@gm ail.com', 'anna,bob@gmail.com',
    'a..b@gmail.com', 'anna.@gmail.com', '.anna@gmail.com', 'anna@-gmail.com', 'anna@gmail..com', '"anna"@gmail.com',
    '=cmd@gmail.com', '+anna@gmail.com', '-anna@gmail.com', 'anna@gmail.c', 'anna\n@gmail.com',
    `${'a'.repeat(65)}@gmail.com`, `a@${'b'.repeat(250)}.com`, 42, null, ['a@gmail.com'],
  ]) bad({ email, consent: true }, 'email')
  for (const email of ['anna+metablend@gmail.com', 'anna_m-1@googlemail.com', 'a@b.io', 'first.last@mail.example.org']) ok({ email, consent: true })
})

test('parseSignup — consent must be exactly true', () => {
  for (const consent of [false, 'true', 1, undefined, null]) bad({ email: 'a@gmail.com', consent }, 'consent')
})

test('parseSignup — phone model and country are short text or nothing', () => {
  bad({ email: 'a@gmail.com', consent: true, phone: 'x'.repeat(MAX_TEXT + 1) }, 'phone')
  bad({ email: 'a@gmail.com', consent: true, country: 'x'.repeat(MAX_TEXT + 1) }, 'country')
  bad({ email: 'a@gmail.com', consent: true, phone: 7 }, 'phone')
  bad({ email: 'a@gmail.com', consent: true, country: 'Aus\u0000tria' }, 'country')
  assert.equal(ok({ email: 'a@gmail.com', consent: true, phone: 'x'.repeat(MAX_TEXT) }).phone_model.length, MAX_TEXT)
})

test('parseSignup — unknown fields and non-objects are rejected (400, never a 500)', () => {
  bad({ email: 'a@gmail.com', consent: true, status: 'added' }, 'status')
  bad({ email: 'a@gmail.com', consent: true, name: 'Anna' }, 'name')
  for (const body of [null, undefined, 'a@gmail.com', ['a@gmail.com'], 3]) bad(body)
  bad({ email: 'a@gmail.com', consent: true, lang: 5 }, 'lang')
})

test('parseSignup — a filled honeypot is accepted as spam (answered like a success, never stored)', () => {
  assert.equal(ok({ email: 'a@gmail.com', consent: true, website: 'http://spam.example' }).spam, true)
  bad({ email: 'a@gmail.com', consent: true, website: 3 }, 'website')
})

test('the sign-up languages are the site languages', () => {
  assert.deepEqual([...SIGNUP_LANGS].sort(), LANGUAGES.map(l => l.code).sort())
})

test('testersCsv — what Play Console takes: one address per line, no header, no commas, no BOM', () => {
  const csv = testersCsv([{ email: 'a@gmail.com' }, { email: 'b@gmail.com' }, { email: 'c@example.org' }])
  assert.equal(csv, 'a@gmail.com\nb@gmail.com\nc@example.org')
  assert.notEqual(csv.charCodeAt(0), 0xfeff)
  assert.ok(!csv.includes(','))
  assert.equal(testersCsv([]), '')
})

test('parseAdminAction — mark the exported new addresses added, up to the export time', () => {
  assert.deepEqual(parseAdminAction({ action: 'mark-added', upTo: '2026-10-26T15:00:00.000Z' }), { ok: true, value: { action: 'mark-added', upTo: '2026-10-26T15:00:00.000Z' } })
  for (const upTo of [undefined, 'yesterday', 5, '']) assert.equal(parseAdminAction({ action: 'mark-added', upTo }).status, 400)
})

test('parseAdminAction — set a status or delete given addresses; delete everyone only with the confirmation', () => {
  assert.deepEqual(parseAdminAction({ action: 'set-status', status: 'opted_in', emails: [' A@gmail.com ', 'b@gmail.com'] }).value,
    { action: 'set-status', status: 'opted_in', emails: ['a@gmail.com', 'b@gmail.com'] })
  assert.deepEqual(parseAdminAction({ action: 'delete', emails: ['a@gmail.com'] }).value, { action: 'delete', emails: ['a@gmail.com'] })
  assert.deepEqual(parseAdminAction({ action: 'delete-all', confirm: 'delete all testers' }).value, { action: 'delete-all' })
  for (const body of [
    { action: 'set-status', status: 'vip', emails: ['a@gmail.com'] },
    { action: 'set-status', status: 'added', emails: [] },
    { action: 'set-status', status: 'added', emails: ['not an email'] },
    { action: 'delete', emails: 'a@gmail.com' },
    { action: 'delete-all' },
    { action: 'delete-all', confirm: 'yes' },
    { action: 'drop' },
    null,
  ]) assert.equal(parseAdminAction(body).status, 400, JSON.stringify(body))
})

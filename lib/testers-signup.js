// The Android tester sign-up (/testers → /api/testers/signup) and the owner's
// export (/api/testers/export): validation and the Play Console list format.
// Pure and import-free on purpose — the routes stay cheap to start.

// the site's languages (a test keeps this in step with lib/i18n.js, which is
// too heavy to load in the route just for its codes)
export const SIGNUP_LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']
export const STATUSES = ['new', 'added', 'opted_in', 'removed']
export const MAX_TEXT = 60
// mb_hp: the honeypot — a name no autofill profile fills in (a "website" field
// could be filled for a real person, who would then be dropped silently)
const FIELDS = new Set(['email', 'consent', 'phone', 'country', 'lang', 'mb_hp'])
const CONTROL = /[\u0000-\u001f\u007f]/

// No leading = + - @ (nothing for a spreadsheet to run), no quotes, commas or
// spaces (the list is one address per line), no ".." or trailing dot.
// Apostrophes and a leading underscore are fine: Google accounts on their own
// domains have them.
const LOCAL = /^[a-z0-9_'](?:[a-z0-9._%+'-]*[a-z0-9_%+'-])?$/
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const TLD = /^(?:[a-z]{2,24}|xn--[a-z0-9-]{1,59})$/

// An international domain as ASCII (punycode) — Firefox sends it as typed,
// Chrome already converted. Only letters, digits, dots and hyphens besides
// non-ASCII letters: "müller.de/x" must not quietly become "müller.de".
function asciiDomain(d) {
  if (/^[a-z0-9.-]+$/.test(d)) return d
  if (/[^a-z0-9.\- -￿]/.test(d)) return null
  try { return new URL(`http://${d}`).hostname } catch { return null }
}

// trimmed and lower-cased (domain in punycode), or null when it isn't a real address
export function normaliseEmail(v) {
  if (typeof v !== 'string') return null
  const typed = v.trim().toLowerCase()
  const at = typed.indexOf('@')
  if (at < 1 || typed.lastIndexOf('@') !== at) return null
  const local = typed.slice(0, at), domain = asciiDomain(typed.slice(at + 1))
  if (!domain || local.length > 64 || !LOCAL.test(local) || local.includes('..')) return null
  const labels = domain.split('.')
  if (labels.length < 2 || !labels.every(l => LABEL.test(l)) || !TLD.test(labels.at(-1))) return null
  const email = `${local}@${domain}`
  return email.length > 254 ? null : email
}

const fail = (field, error) => ({ ok: false, status: 400, field, error })

// optional short text: trimmed, empty → null, no control characters
function optionalText(v) {
  if (v == null) return { ok: true, value: null }
  if (typeof v !== 'string' || CONTROL.test(v)) return { ok: false }
  const s = v.trim()
  return s.length > MAX_TEXT ? { ok: false } : { ok: true, value: s || null }
}

// The form's JSON → the row to store. `mb_hp` is the hidden honeypot: a
// person never fills it, so a filled one is answered like a success but
// never stored (spam: true).
export function parseSignup(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(null, 'Send the form as a JSON object.')
  const unknown = Object.keys(body).find(k => !FIELDS.has(k))
  if (unknown) return fail(unknown, `Unknown field: ${unknown}`)
  const email = normaliseEmail(body.email)
  if (!email) return fail('email', 'Enter a valid email address.')
  if (body.consent !== true) return fail('consent', 'Please agree to how the address is used.')
  const phone = optionalText(body.phone)
  if (!phone.ok) return fail('phone', `Phone model: up to ${MAX_TEXT} characters.`)
  const country = optionalText(body.country)
  if (!country.ok) return fail('country', `Country: up to ${MAX_TEXT} characters.`)
  if (body.lang != null && typeof body.lang !== 'string') return fail('lang', 'Unknown language.')
  if (body.mb_hp != null && typeof body.mb_hp !== 'string') return fail('mb_hp', 'Unknown field: mb_hp')
  return {
    ok: true,
    value: {
      email,
      phone_model: phone.value,
      country: country.value,
      language: SIGNUP_LANGS.includes(body.lang) ? body.lang : 'en',
      spam: !!body.mb_hp,
    },
  }
}

// Play Console's email-list upload: one address per line, no header, no
// commas, plain UTF-8 (it refuses a BOM). An upload REPLACES the list, so the
// export always holds everyone still in the test, not just the new ones.
export const testersCsv = rows => rows.map(r => r.email).join('\n')

function emailList(v) {
  if (!Array.isArray(v) || !v.length || v.length > 500) return null
  const out = v.map(normaliseEmail)
  return out.every(Boolean) ? out : null
}

// The owner's actions on the list (POST /api/testers/export). Marking the
// exported ones added is set-status with exactly the addresses that export
// held (scripts/testers.mjs keeps them) — never "everything new up to a time",
// which can catch someone who signed up after the file was made.
export function parseAdminAction(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(null, 'Send a JSON object with an action.')
  switch (body.action) {
    case 'set-status': {
      if (!STATUSES.includes(body.status)) return fail('status', `status: one of ${STATUSES.join(', ')}.`)
      const emails = emailList(body.emails)
      return emails ? { ok: true, value: { action: 'set-status', status: body.status, emails } } : fail('emails', 'emails: a list of addresses.')
    }
    case 'delete': {
      const emails = emailList(body.emails)
      return emails ? { ok: true, value: { action: 'delete', emails } } : fail('emails', 'emails: a list of addresses.')
    }
    case 'delete-all':
      return body.confirm === 'delete all testers'
        ? { ok: true, value: { action: 'delete-all' } }
        : fail('confirm', 'confirm: "delete all testers".')
    default:
      return fail('action', 'action: set-status, delete or delete-all.')
  }
}

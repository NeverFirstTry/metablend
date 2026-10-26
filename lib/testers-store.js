// The tester list in the database (supabase/tester-signups.sql). `db` is the
// PostgREST client from lib/supabase.js; every call throws on a database error.

const ACTIVE = ['new', 'added', 'opted_in']
const PAGE = 1000 // Supabase answers at most 1000 rows per request

const check = ({ data, error }) => {
  if (error) throw new Error(`tester_signups: ${error.message}`)
  return data
}

// A second sign-up of the same address changes nothing — except that someone
// taken off the list (removed) is new again. The form says the same either
// way, so it never tells whether an address is on the list.
export async function saveSignup(db, row, now = new Date()) {
  check(await db.from('tester_signups').upsert(row, { onConflict: 'email', ignoreDuplicates: true }))
  check(await db.from('tester_signups').update({ status: 'new', updated_at: now.toISOString() }).eq('email', row.email).eq('status', 'removed'))
}

// Everyone still in the test, oldest first — or only the new sign-ups. Page
// by page, so a long list is never cut off at 1000.
export async function listTesters(db, { onlyNew = false } = {}) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const q = db.from('tester_signups').select('email, status, created_at')
    const page = check(await (onlyNew ? q.eq('status', 'new') : q.in('status', ACTIVE)).order('created_at').order('email').range(from, from + PAGE - 1)) ?? []
    out.push(...page)
    if (page.length < PAGE) return out
  }
}

// The owner's actions (lib/testers-signup.js parseAdminAction) → which addresses changed.
export async function applyAdminAction(db, a, now = new Date()) {
  const t = db.from('tester_signups')
  const q =
    a.action === 'set-status' ? t.update({ status: a.status, updated_at: now.toISOString() }).in('email', a.emails)
    : a.action === 'delete' ? t.delete().in('email', a.emails)
    : t.delete().not('email', 'is', null) // delete-all: when the test ends
  const emails = (check(await q.select('email')) ?? []).map(r => r.email)
  return { action: a.action, changed: emails.length, emails }
}

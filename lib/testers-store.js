// The tester list in the database (supabase/tester-signups.sql). `db` is the
// PostgREST client from lib/supabase.js; every call throws on a database error.

const ACTIVE = ['new', 'added', 'opted_in']

const check = ({ data, error }) => {
  if (error) throw new Error(`tester_signups: ${error.message}`)
  return data
}

// A second sign-up of the same address changes nothing (and the form says the
// same either way, so it never tells whether an address is on the list).
export async function saveSignup(db, row) {
  check(await db.from('tester_signups').upsert(row, { onConflict: 'email', ignoreDuplicates: true }))
}

// Everyone still in the test, oldest first — or only the new sign-ups.
export async function listTesters(db, { onlyNew = false } = {}) {
  const q = db.from('tester_signups').select('email, status, created_at')
  return check(await (onlyNew ? q.eq('status', 'new') : q.in('status', ACTIVE)).order('created_at')) ?? []
}

// The owner's actions (lib/testers-signup.js parseAdminAction) → which addresses changed.
export async function applyAdminAction(db, a, now = new Date()) {
  const t = db.from('tester_signups')
  const touched = { status: a.status ?? 'added', updated_at: now.toISOString() }
  const q =
    a.action === 'mark-added' ? t.update(touched).eq('status', 'new').lte('created_at', a.upTo)
    : a.action === 'set-status' ? t.update(touched).in('email', a.emails)
    : a.action === 'delete' ? t.delete().in('email', a.emails)
    : t.delete().not('email', 'is', null) // delete-all: when the test ends
  const emails = (check(await q.select('email')) ?? []).map(r => r.email)
  return { action: a.action, changed: emails.length, emails }
}

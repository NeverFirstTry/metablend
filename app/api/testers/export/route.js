import { withErrorLog } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { testersCsv, parseAdminAction } from '@/lib/testers-signup'
import { listTesters, applyAdminAction } from '@/lib/testers-store'

// The owner's side of the Android tester list — the calibrate key in the
// x-calibrate-key header (never a query parameter). scripts/testers.mjs wraps it.
//
// GET → the Play Console email list: everyone still in the test, one address
// per line. Upload it to an email list kept ONLY for these sign-ups (e.g.
// "metablend.app sign-ups"; a track can have several lists): an upload
// REPLACES the whole list, so addresses typed into it by hand would be gone.
// GET ?format=json[&only=new] → the same rows as JSON (email, status,
// created_at), so the script knows exactly which new addresses a file held.
//
// POST → { action: 'set-status', status, emails } (e.g. added, for exactly the
// exported new ones) | { action: 'delete', emails } (on request) |
// { action: 'delete-all', confirm: 'delete all testers' } (when the test ends).
const NO_STORE = { 'Cache-Control': 'no-store' }
const denied = request => {
  const problem = jobKeyProblem(request)
  return problem && Response.json({ error: problem.error }, { status: problem.status, headers: NO_STORE })
}

export const GET = withErrorLog('testers.export', async (request) => {
  const no = denied(request)
  if (no) return no
  const sp = new URL(request.url).searchParams
  if (sp.get('format') === 'json') {
    return Response.json({ testers: await listTesters(supabase, { onlyNew: sp.get('only') === 'new' }) }, { headers: NO_STORE })
  }
  const rows = await listTesters(supabase)
  return new Response(testersCsv(rows), {
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="metablend-testers.csv"',
      'X-Count': String(rows.length),
      'X-New': String(rows.filter(r => r.status === 'new').length),
    },
  })
})

export const POST = withErrorLog('testers.export', async (request) => {
  const no = denied(request)
  if (no) return no
  const parsed = parseAdminAction(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error, field: parsed.field }, { status: 400, headers: NO_STORE })
  return Response.json(await applyAdminAction(supabase, parsed.value), { headers: NO_STORE })
})

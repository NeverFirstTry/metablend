import { withErrorLog } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { testersCsv, parseAdminAction } from '@/lib/testers-signup'
import { listTesters, applyAdminAction } from '@/lib/testers-store'

// The owner's side of the Android tester list — the calibrate key in the
// x-calibrate-key header (never a query parameter). scripts/testers.mjs wraps it.
//
// GET → the Play Console email list (Closed testing → Testers → email list →
// upload CSV): everyone still in the test, one address per line. An upload
// REPLACES the list, which is why it holds everyone, not just the new ones.
// GET ?only=new → just the new addresses, comma-separated, for Play's
// "add email addresses" box (which appends) or the Bcc of the opt-in mail.
// X-Exported-At says when; POST { action: 'mark-added', upTo: <it> } then
// marks exactly those new ones added.
//
// POST → { action: 'mark-added', upTo } | { action: 'set-status', status,
// emails } | { action: 'delete', emails } | { action: 'delete-all', confirm:
// 'delete all testers' } (when the test ends).
const NO_STORE = { 'Cache-Control': 'no-store' }
const denied = request => {
  const problem = jobKeyProblem(request)
  return problem && Response.json({ error: problem.error }, { status: problem.status, headers: NO_STORE })
}

export const GET = withErrorLog('testers.export', async (request) => {
  const no = denied(request)
  if (no) return no
  const onlyNew = new URL(request.url).searchParams.get('only') === 'new'
  // taken before the read: a sign-up during the read is never marked added unseen
  const exportedAt = new Date().toISOString()
  const rows = await listTesters(supabase, { onlyNew })
  const headers = {
    ...NO_STORE,
    'X-Exported-At': exportedAt,
    'X-Count': String(rows.length),
    'X-New': String(rows.filter(r => r.status === 'new').length),
  }
  if (onlyNew) return new Response(rows.map(r => r.email).join(', '), { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } })
  return new Response(testersCsv(rows), {
    headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="metablend-testers.csv"' },
  })
})

export const POST = withErrorLog('testers.export', async (request) => {
  const no = denied(request)
  if (no) return no
  const parsed = parseAdminAction(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error, field: parsed.field }, { status: 400, headers: NO_STORE })
  return Response.json(await applyAdminAction(supabase, parsed.value), { headers: NO_STORE })
})

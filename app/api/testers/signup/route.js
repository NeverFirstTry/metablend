import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { supabase } from '@/lib/supabase'
import { feedbackOriginProblem } from '@/lib/feedback'
import { parseSignup } from '@/lib/testers-signup'
import { saveSignup } from '@/lib/testers-store'

// POST /api/testers/signup — the Android tester form on /testers: the address
// of the Google account on the tester's phone, for the owner to add to the
// Play closed test (/api/testers/export). Only from the site's own pages (the
// same check as weather reports), a few tries per IP, and a honeypot.
const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60e3 })
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const POST = withErrorLog('testers.signup', async (request) => {
  const foreign = feedbackOriginProblem(request.headers)
  if (foreign) return json({ error: foreign.error }, foreign.status)
  if (limiter.limited(clientIp(request))) return json({ error: 'Too many tries — please wait a few minutes.' }, 429)
  const parsed = parseSignup(await request.json().catch(() => null))
  if (!parsed.ok) return json({ error: parsed.error, field: parsed.field }, 400)
  const { spam, ...row } = parsed.value
  // a filled honeypot gets the same answer, so a bot learns nothing
  if (!spam) await saveSignup(supabase, row)
  return json({ ok: true })
})

import { supabase } from '@/lib/supabase'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { healthProblems, WINDOW_MIN } from '@/lib/health'

// Is the site well? An outside monitor asks this every five minutes and mails when the answer is 503
// (lib/health.js has the limits). 200 { ok: true } or 503 { ok: false, problems: [...] }. Two small
// database reads, kept a minute per server, so asking it often costs nothing more; never cached outside.
// GET /api/health

const limiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })
let last = null
const answer = ({ status, body }) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request) {
  const now = Date.now()
  // a minute old is fresh enough; an address over the limit gets the kept answer whatever its age
  if (last && (now - last.at < 60_000 || limiter.limited(clientIp(request)))) return answer(last)
  let errors = null, jobs = null, dbDown = false
  try {
    const [e, j] = await Promise.all([
      supabase.from('error_log').select('scope').gte('created_at', new Date(now - WINDOW_MIN * 60_000).toISOString()).limit(1000),
      supabase.from('job_runs').select('job, started_at, status_code').gte('started_at', new Date(now - 27 * 3600_000).toISOString()).order('started_at', { ascending: false }).limit(1000),
    ])
    errors = e.data; jobs = j.data; dbDown = !!(e.error || j.error)
  } catch { dbDown = true }
  const problems = healthProblems({ errors, jobs, dbDown, now })
  last = { at: now, status: problems.length ? 503 : 200, body: { ok: !problems.length, problems, checked: new Date(now).toISOString() } }
  return answer(last)
}

import { supabase } from '@/lib/supabase'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { DB_ALARM_MB, DB_PLAN_MB } from '@/lib/health'

// Is the database filling up? Its own address, apart from /api/health on purpose (owner, 2026-11-20): a main
// check that fails for the size spoils the uptime figures and can set off the deploy guard and a rollback.
// A second outside monitor asks this one. 200 below DB_ALARM_MB, 503 from there on, and 503 when the size
// cannot be read: an alarm that cannot see must not say "all is well". One small database call
// (supabase/database-size.sql), kept a minute per server; never cached outside. Nothing but the size, the
// two limits and the time is in the answer.
// GET /api/health/db

const limiter = createRateLimiter({ max: 30, windowMs: 60 * 1000 })
let last = null
const answer = ({ status, body }) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request) {
  const now = Date.now()
  // a minute old is fresh enough; an address over the limit gets the kept answer whatever its age
  if (last && (now - last.at < 60_000 || limiter.limited(clientIp(request)))) return answer(last)
  let bytes = null
  try { bytes = (await supabase.rpc('database_size')).data } catch { /* no size: 503 below */ }
  const databaseMb = typeof bytes === 'number' ? Math.round(bytes / 1048576) : null
  const ok = databaseMb != null && databaseMb < DB_ALARM_MB
  last = { at: now, status: ok ? 200 : 503, body: { ok, databaseMb, alarmMb: DB_ALARM_MB, planMb: DB_PLAN_MB, checked: new Date(now).toISOString() } }
  return answer(last)
}

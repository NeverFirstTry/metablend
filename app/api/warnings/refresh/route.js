import { withErrorLog, logError } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getJson } from '@/lib/outlook/http'
import { FEEDS, feedUrl } from '@/lib/warnings/feeds'
import { refreshAll } from '@/lib/warnings/refresh'
import { saveCountry } from '@/lib/warnings/store'

// GET /api/warnings/refresh — pg_cron every 15 min (supabase/cron.sql),
// with the calibrate key. Reads the 35 MeteoAlarm country feeds into the
// warnings table; a failing feed keeps its country's rows.
export const maxDuration = 120

export const GET = withErrorLog('warnings.refresh', async (request) => {
  const denied = jobKeyProblem(request)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })
  const summary = await refreshAll({
    feeds: FEEDS,
    fetchFeed: slug => getJson(feedUrl(slug), { ms: 15000, cache: 'no-store' }),
    save: (country, rows, at) => saveCountry(supabase, country, rows, at),
  })
  if (summary.failed.length) await logError('warnings.upstream', new Error(`${summary.failed.length} feeds failed`), { failed: summary.failed })
  return Response.json(summary)
})

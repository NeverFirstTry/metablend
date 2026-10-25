import { withErrorLog, logError } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getJson } from '@/lib/outlook/http'
import { FEEDS, AREA_FEEDS, feedUrl } from '@/lib/warnings/feeds'
import { refreshAll, applyPending } from '@/lib/warnings/refresh'
import { saveCountry } from '@/lib/warnings/store'

// GET /api/warnings/refresh — called by pg_cron (supabase/cron.sql) with the
// calibrate key, only when a MeteoAlarm feed changed: the database has
// already downloaded and trimmed the feeds (supabase/warnings-feeds.sql), so
// this parses and saves just those countries. Until that SQL exists it falls
// back to downloading every feed itself (the old, 19 MB way).
export const GET = withErrorLog('warnings.refresh', async (request) => {
  const denied = jobKeyProblem(request)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })
  const save = (country, rows, at) => saveCountry(supabase, country, rows, at)

  const { data: pending, error } = await supabase.from('warning_feeds_pending').select('country, body, hash')
  const summary = error
    ? { ...(await refreshAll({ feeds: [...FEEDS, ...AREA_FEEDS], fetchFeed: slug => getJson(feedUrl(slug), { ms: 15000, cache: 'no-store' }), save })), source: 'download' }
    : {
        ...(await applyPending({
          pending,
          save,
          markDone: async (country, hash) => {
            const { error: e } = await supabase.from('warning_feeds').update({ processed_hash: hash }).eq('country', country).eq('hash', hash)
            if (e) throw new Error(e.message)
          },
        })),
        source: 'database',
      }
  if (summary.failed.length) await logError('warnings.upstream', new Error(`${summary.failed.length} feeds failed`), { failed: summary.failed })
  return Response.json(summary)
})

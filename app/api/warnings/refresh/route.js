import { withErrorLog, logError } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getJson } from '@/lib/outlook/http'
import { FEEDS, AREA_FEEDS, feedUrl } from '@/lib/warnings/feeds'
import { refreshWarnings } from '@/lib/warnings/refresh'
import { saveCountry } from '@/lib/warnings/store'

// GET /api/warnings/refresh — called by pg_cron (supabase/cron.sql) with the
// calibrate key when a MeteoAlarm feed changed or the database couldn't get
// one lately: the database has already downloaded and trimmed the feeds
// (supabase/warnings-feeds.sql), so this parses and saves just the changed
// countries and downloads only the late ones itself. Until that SQL exists it
// downloads every feed itself (the old, 19 MB way).
export const GET = withErrorLog('warnings.refresh', async (request) => {
  const denied = jobKeyProblem(request)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })

  const summary = await refreshWarnings({
    readBehind: () => supabase.from('warning_feeds_behind').select('country, last_status, last_error'),
    readPending: () => supabase.from('warning_feeds_pending').select('country, body, hash'),
    markDone: async (country, hash) => {
      const { error } = await supabase.from('warning_feeds').update({ processed_hash: hash }).eq('country', country).eq('hash', hash)
      if (error) throw new Error(error.message)
    },
    feeds: [...FEEDS, ...AREA_FEEDS],
    fetchFeed: slug => getJson(feedUrl(slug), { ms: 15000, cache: 'no-store' }),
    save: (country, rows, at) => saveCountry(supabase, country, rows, at),
    log: (scope, message, meta) => logError(scope, new Error(message), meta),
  })
  if (summary.failed.length) await logError('warnings.upstream', new Error(`${summary.failed.length} feeds failed`), { failed: summary.failed })
  return Response.json(summary)
})

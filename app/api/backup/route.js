import { supabase } from '@/lib/supabase'
import { isAuthorizedJob } from '@/lib/auth'
import { withErrorLog } from '@/lib/log'

// Nightly export of the learned state — the data that can't be re-derived if
// the database is lost (Supabase's free tier has no automated backups).
// Fetched by .github/workflows/backup.yml, which stores the JSON as a workflow
// artifact. Everything here is already publicly readable through the app's own
// endpoints (leaderboard, heatmap), so an artifact on a public repo leaks
// nothing new; error_log is deliberately NOT included.
export const maxDuration = 60

const TABLES = [
  { name: 'api_weights', order: 'id' },
  { name: 'city_bias', order: 'city' },
  { name: 'feedback', order: 'id', cap: 20000 },
  { name: 'api_stats', order: 'api_id' },
]

export const GET = withErrorLog('backup', async (request) => {
  if (!isAuthorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const tables = {}
  for (const t of TABLES) {
    let q = supabase.from(t.name).select('*').order(t.order, { ascending: true })
    if (t.cap) q = q.limit(t.cap)
    const { data, error } = await q
    tables[t.name] = error ? { error: error.message } : data
  }

  return Response.json(
    { exported_at: new Date().toISOString(), tables },
    { headers: { 'Content-Disposition': 'attachment; filename="metablend-backup.json"' } }
  )
})

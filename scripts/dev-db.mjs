// The dev database (README, "Databases").
//   node scripts/dev-db.mjs build   supabase/dev-schema.sql from supabase/*.sql
//   node scripts/dev-db.mjs check   .env.local points at a dev project (not
//                                   production) and every table is there —
//                                   prints names and statuses only, never keys
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { buildDevSchema } from './lib/dev-schema.mjs'
import { parseEnv } from './lib/production.mjs'
import { isProductionUrl } from '../lib/db-target.js'

const TABLES = ['api_weights', 'forecasts', 'feedback', 'city_bias', 'consensus_history', 'api_stats', 'outlook_snapshots', 'outlook_weights',
  'error_log', 'push_devices', 'push_log', 'hike_plans', 'route_cache', 'warnings', 'warning_feeds', 'warning_feeds_pending', 'tester_signups', 'nominatim_gate', 'nominatim_cache', 'summits', 'towns']
const [cmd] = process.argv.slice(2)

if (cmd === 'build') {
  writeFileSync(new URL('../supabase/dev-schema.sql', import.meta.url), buildDevSchema())
  console.log('supabase/dev-schema.sql written')
} else if (cmd === 'check') {
  const env = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {}
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) { console.error('.env.local has no NEXT_PUBLIC_SUPABASE_URL / key.'); process.exit(1) }
  if (isProductionUrl(url)) { console.error('.env.local still points at the PRODUCTION project — put the dev project there.'); process.exit(1) }
  console.log(`dev project: ${new URL(url).host.split('.')[0]}`)
  let missing = 0
  for (const t of TABLES) {
    // a real select: a head-only count hides a missing table (PGRST205)
    const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    const body = res.ok ? null : await res.json().catch(() => ({}))
    if (!res.ok) missing++
    console.log(`  ${t}: ${res.ok ? 'ok' : `${res.status} ${body?.code ?? ''}`}`)
  }
  console.log(missing ? `${missing} missing — paste supabase/dev-schema.sql into the dev project's SQL editor.` : 'all tables there')
  process.exit(missing ? 1 : 0)
} else {
  console.error('usage: node scripts/dev-db.mjs build|check')
  process.exit(1)
}

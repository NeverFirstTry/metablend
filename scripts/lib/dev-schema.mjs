// The whole database schema for a fresh dev project, from the files the
// production project was set up with, in the order they ran there. cron.sql
// stays out: its jobs call the production site (supabase/dev-schema.test.js).
import { readFileSync } from 'node:fs'

export const SCHEMA_FILES = [
  'setup_all.sql', // base tables, seeds, batch functions
  'migration7.sql', // pinned search_path of those functions
  'push.sql', // push devices, planned hikes, push log
  'migration8.sql', // route cache, a planned hike's route
  'warnings.sql',
  'warnings-trim.sql',
  'warnings-feeds.sql', // downloads feeds when called; no job calls it in dev
  'tester-signups.sql',
  'nominatim.sql', // the one-request-a-second gate and the answer cache
  'places.sql', // our summits, huts and towns (PostGIS, pg_trgm, unaccent)
  'feedback-lessons.sql', // one weight lesson per city per half hour
  'station-errors.sql', // the weighting formula's shadow run
  'job-runs.sql', // one row per scheduled job run: status, duration, summary
  'open-meteo-calls.sql', // our Open-Meteo request count per UTC day and hour
  'geocode-cache.sql', // town_lookup over our towns, and Open-Meteo's geocoding answers for 30 days
  'town-near.sql', // the town at a rounded position, for "My location"
  'place-climate.sql', // a place's climate table, asked from Open-Meteo once a year
  'route-heights.sql', // a route's heights, asked from Open-Meteo once and kept
  'enable_rls.sql',
]

const read = name => readFileSync(new URL(`../../supabase/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n').trimEnd()

export function buildDevSchema() {
  const head = `-- MetaBlend dev database — the whole schema for a fresh Supabase project.
-- Built by \`node scripts/dev-db.mjs build\` from supabase/*.sql; don't edit it
-- here. Paste it into the dev project's SQL editor and press Run (safe to run
-- again). No scheduled jobs: production's (cron.sql) call the live site.
`
  return [head, ...SCHEMA_FILES.map(f => `-- ═══ ${f} ${'═'.repeat(Math.max(3, 70 - f.length))}\n${read(f)}\n`)].join('\n')
}

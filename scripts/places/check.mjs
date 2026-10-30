// After a load: the app's own search and Near you code on the dev database
// (lib/places/checks.js — matterhron, cervino, zermatt, hà nội, Near you in
// the Jungfrau region and Sa Pa) and how long each query takes inside it,
// into data/places/check-summary.json for the refresh issue. Exits 1 when a
// check fails.
//   node scripts/places/check.mjs
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import featured from '../../lib/hike/featured.json' with { type: 'json' }
import { makePlaces } from '../../lib/places/db.js'
import { runChecks } from '../../lib/places/checks.js'
import { devDatabase } from './env.mjs'

devDatabase()
// lib/supabase.js reads the environment when it loads: only after it's set
const { supabase } = await import(pathToFileURL(join(process.cwd(), 'lib/supabase.js')).href)

const checks = await runChecks({ places: makePlaces(supabase), featured })
for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.check.padEnd(28)} ${String(c.ms).padStart(5)} ms  ${c.got}${c.ok ? '' : `  (expected: ${c.want})`}`)
const { data: bench, error } = await supabase.rpc('places_bench', { n: 10 })
if (error) console.log('places_bench:', error.message)
for (const b of bench ?? []) console.log(`${String(b.avg_ms).padStart(8)} ms  ${b.query}`)
writeFileSync(join('data', 'places', 'check-summary.json'), JSON.stringify({ checks, bench: bench ?? [] }, null, 1))
if (checks.some(c => !c.ok)) process.exit(1)

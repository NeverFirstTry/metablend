// Step 2 of the local route run: the peak files that scripts/routes/local.mjs wrote, into the database:
// the dev project (.env.local), or production after you confirm (scripts/lib/production.mjs; on the PC
// only). It only adds. A peak that already has a route list keeps it, heights already stored for a
// route's line stay as they are, and nothing is replaced or deleted, so a second run changes nothing.
// Only whole lists go in: a peak with a route its extract cut gets no list here, the site looks it up itself
// at the first visit (its heights go in all the same).
// The site then finds the list (for 30 days, as after its own lookup) and the heights (for good) in the
// database and asks neither OpenStreetMap nor Open-Meteo for them.
// A list's date is its file's: copy the folder with the files' times kept (cp -p).
//   node scripts/routes/load.mjs --from=<folder of peak files>                 the dev database
//   node scripts/routes/load.mjs --from=<folder of peak files> --production    production (asks first)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { confirmProduction, loadProduction } from '../lib/production.mjs'
import { fail, devDatabase } from '../places/env.mjs'
import { loadPlan } from '../../lib/route/local.js'

const FROM = process.argv.find(a => a.startsWith('--from='))?.slice(7)
if (!FROM) fail('--from=<folder> is required: the out folder of scripts/routes/local.mjs')
const production = process.argv.includes('--production')
const files = readdirSync(FROM).filter(n => n.endsWith('.json')).map(n => ({ ...JSON.parse(readFileSync(join(FROM, n), 'utf8')), at: statSync(join(FROM, n)).mtimeMs }))
if (!files.length) fail(`No peak files in ${FROM}.`)

// reading comes first (which peaks have a list), the question after it, the writing last
if (production) loadProduction()
else devDatabase()
const { supabase } = await import('../../lib/supabase.js')
const must = async (what, call) => { const { data, error } = await call; if (error) fail(`${what} failed: ${error.message}. What was written stays; the same command goes on from here.`); return data }
const parts = (rows, n) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n))

const have = new Set()
for (const keys of parts(files.map(f => f.peak_key), 100)) for (const row of await must('Reading route_cache', supabase.from('route_cache').select('peak_key').in('peak_key', keys))) have.add(row.peak_key)
const plan = loadPlan(files, have)
const what = `add ${plan.cache.length} route lists (of the ${files.length} peaks ${plan.held.length} have one and keep it, and ${plan.left.length} with a route their extract cut are left to the site's own lookup) and up to ${plan.heights.length} rows of route heights (rows already stored stay as they are); nothing is replaced or deleted`
if (production) await confirmProduction(what)
else console.log(`This will ${what}, in the dev database.`)

let lists = 0, rows = 0
for (const part of parts(plan.cache, 10)) lists += (await must('Writing route_cache', supabase.from('route_cache').upsert(part, { onConflict: 'peak_key', ignoreDuplicates: true }).select('peak_key'))).length
for (const part of parts(plan.heights, 200)) rows += (await must('Writing route_heights', supabase.from('route_heights').upsert(part, { onConflict: 'route_id,geom', ignoreDuplicates: true }).select('route_id'))).length
console.log(`Done: ${lists} route lists added, ${rows} rows of route heights added (${plan.heights.length - rows} were already there).`)

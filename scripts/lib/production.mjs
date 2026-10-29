// Admin scripts and the production database. .env.local belongs to the dev
// project; the production keys live in .env.production-admin (git-ignored —
// Next never loads it). loadProduction() is for reading; confirmProduction()
// says what will change and goes on only when the project ref is typed, or
// passed as --confirm=<ref> on a deliberate run. Import lib/supabase.js only
// after either (it reads the URL when it loads).
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { PRODUCTION_REF, isProductionUrl } from '../../lib/db-target.js'

export const ADMIN_ENV = '.env.production-admin'

export function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i < 1 || line.trimStart().startsWith('#')) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
  }
  return out
}

export const confirmArg = argv => argv.find(a => a.startsWith('--confirm='))?.slice('--confirm='.length) ?? null

const fail = msg => { console.error(msg); process.exit(1) }

// the production keys over whatever .env.local set
export function loadProduction() {
  if (!existsSync(ADMIN_ENV)) fail(`No ${ADMIN_ENV} — the production keys go there (see README, "Databases").`)
  const env = parseEnv(readFileSync(ADMIN_ENV, 'utf8'))
  if (!isProductionUrl(env.NEXT_PUBLIC_SUPABASE_URL)) fail(`${ADMIN_ENV} doesn't point at the production project.`)
  Object.assign(process.env, env)
  return env
}

export async function confirmProduction(what, argv = process.argv) {
  loadProduction()
  console.log(`This will ${what} — in the PRODUCTION database (${PRODUCTION_REF}).`)
  let answer = confirmArg(argv)
  if (answer == null) {
    if (!process.stdin.isTTY) fail(`Not confirmed: run it in a terminal and type the project ref, or pass --confirm=${PRODUCTION_REF}.`)
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    answer = (await rl.question(`Type ${PRODUCTION_REF} to go on: `)).trim()
    rl.close()
  }
  if (answer !== PRODUCTION_REF) fail('Not confirmed — nothing was changed.')
  process.env.METABLEND_PRODUCTION_CONFIRMED = PRODUCTION_REF
}

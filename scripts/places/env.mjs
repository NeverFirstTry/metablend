// The dev database for the places scripts: .env.local on the PC, the
// environment in CI (the refresh workflow sets it from the DEV_SUPABASE_*
// secrets). Never production — that's scripts/lib/production.mjs, on the
// owner's PC only.
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from '../lib/production.mjs'
import { isProductionUrl } from '../../lib/db-target.js'

export const fail = msg => { console.error(msg); process.exit(1) }

export function devDatabase() {
  if (existsSync('.env.local')) Object.assign(process.env, parseEnv(readFileSync('.env.local', 'utf8')))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) fail('No dev database: put it in .env.local, or set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  if (isProductionUrl(url)) fail('That points at production — the places scripts touch it only with --production, on the PC.')
}

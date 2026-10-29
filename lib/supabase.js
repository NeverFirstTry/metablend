import { PostgrestClient } from '@supabase/postgrest-js'
import { writeBlocked } from './db-target.js'

// Server-only Supabase client. This module is imported exclusively from /api
// route handlers (never shipped to the browser), so it prefers the
// service-role key, which bypasses RLS. That lets you lock the database down
// (run supabase/enable_rls.sql) without breaking a single route. If the
// service-role key isn't set it falls back to the public anon key, which is
// what local/dev and the current RLS-off beta use.
// `||` (not `??`) so an empty SUPABASE_SERVICE_ROLE_KEY placeholder falls back
// to the anon key instead of resolving to an empty string.
//
// Only the database part of supabase-js — all we use is .from() and .rpc().
// The full client also loads auth, storage, realtime and functions: ~30 ms of
// CPU on every cold start of every route, for nothing.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const READS = new Set(['GET', 'HEAD'])

export function makeClient(base, apiKey, env = process.env) {
  return new PostgrestClient(`${base}/rest/v1`, {
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    // looked up per call, as supabase-js did (Next's instrumented fetch, test stubs)
    fetch: (input, init) => {
      // a local run never writes to the production database (lib/db-target.js);
      // the client hands the refusal back as { error }, like any failed call
      if (!READS.has(init?.method ?? 'GET') && writeBlocked(base, env)) {
        return Promise.reject(new Error('Refused: a local run does not write to the production database — point .env.local at the dev project, or use an admin script (scripts/lib/production.mjs)'))
      }
      return fetch(input, init)
    },
  })
}

export const supabase = makeClient(url, key)

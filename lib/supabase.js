import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client. This module is imported exclusively from /api
// route handlers (never shipped to the browser), so it prefers the
// service-role key, which bypasses RLS. That lets you lock the database down
// (run supabase/enable_rls.sql) without breaking a single route. If the
// service-role key isn't set it falls back to the public anon key, which is
// what local/dev and the current RLS-off beta use.
// `||` (not `??`) so an empty SUPABASE_SERVICE_ROLE_KEY placeholder falls back
// to the anon key instead of resolving to an empty string.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

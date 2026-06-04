-- ════════════════════════════════════════════════════════════════════════════
-- MetaBlend — lock down the database (run AFTER setup_all.sql).
--
-- Prerequisite: set SUPABASE_SERVICE_ROLE_KEY in your server env
--   • locally:  add it to .env.local
--   • on Vercel: Project → Settings → Environment Variables
-- Then restart/redeploy so lib/supabase.js picks it up.
--
-- This enables RLS with NO policies, so the public anon key (which ships in the
-- browser bundle) can no longer read or write any table. The server uses the
-- service-role key, which bypasses RLS — and the browser never queries Supabase
-- directly (it only calls /api/* routes), so nothing breaks.
--
-- To roll back to the open beta, see setup_all.sql (… disable row level security).
-- ════════════════════════════════════════════════════════════════════════════
alter table api_weights       enable row level security;
alter table forecasts         enable row level security;
alter table feedback          enable row level security;
alter table consensus_history enable row level security;
alter table api_stats         enable row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- MetaBlend — lock down the database (run AFTER setup_all.sql).
--
-- Prerequisite: set SUPABASE_SERVICE_ROLE_KEY in your server env
--   • locally:  add it to .env.local
--   • on Vercel: Project → Settings → Environment Variables
-- Then restart/redeploy so lib/supabase.js picks it up.
--
-- This (1) drops any lingering permissive policies — older tables like forecasts
-- and feedback often shipped with an "allow all" policy that keeps anon access
-- open even after RLS is enabled — and (2) enables RLS with NO policies, so the
-- public anon key can no longer read or write any table. The server uses the
-- service-role key, which bypasses RLS; the browser never queries Supabase
-- directly (only /api/* routes), so nothing breaks.
--
-- Safe to re-run. To reopen the beta: `alter table <t> disable row level security`.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Drop every existing policy on the app tables (so none stays permissive).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('api_weights','forecasts','feedback','consensus_history','api_stats','error_log','city_bias')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. Enable RLS (no policies = deny-all for anon; service role bypasses it).
alter table api_weights       enable row level security;
alter table forecasts         enable row level security;
alter table feedback          enable row level security;
alter table consensus_history enable row level security;
alter table api_stats         enable row level security;
alter table error_log         enable row level security;
alter table city_bias         enable row level security;

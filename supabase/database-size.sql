-- The size of the database in bytes, for the nightly job (app/api/cleanup/route.js). The plan holds
-- 500 MB (the free plan; past that the project is switched to read-only), and nothing told us how full it
-- was: 274.7 MB on 2026-10-30, 348 MB on 2026-11-20. The job writes the size into its summary (job_runs),
-- so the growth per day can be read there, and at 400 MB or more it leaves the note that /api/health
-- reports (lib/health.js), which the outside monitor turns into a mail.
-- Runs with the caller's rights: every role that may connect may ask the size of the database. Not
-- callable by the public API roles, like every other function here. Safe to run more than once.
create or replace function public.database_size() returns bigint
language sql stable
set search_path = ''
as $$ select pg_catalog.pg_database_size(pg_catalog.current_database()) $$;
revoke all on function public.database_size() from public, anon, authenticated;
grant execute on function public.database_size() to service_role;

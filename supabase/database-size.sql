-- The size of the database in bytes, for the nightly job (app/api/cleanup/route.js). The plan holds
-- 500 MB (the free plan; past that the project is switched to read-only), and nothing told us how full it
-- was: 274.7 MB on 2026-10-30, 348 MB on 2026-11-20. The job writes the size into its summary (job_runs),
-- so the growth per day can be read there. The address /api/health/db reads it too and answers 503 from
-- 400 MB on; a monitor of its own asks that address (the main health check never fails for the size).
create or replace function public.database_size() returns bigint
language sql stable
set search_path = ''
as $$ select pg_catalog.pg_database_size(pg_catalog.current_database()) $$;
revoke all on function public.database_size() from public, anon, authenticated;
grant execute on function public.database_size() to service_role;

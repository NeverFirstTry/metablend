-- One row per run of a scheduled job (/api/cleanup, /api/calibrate, /api/push/dispatch,
-- /api/warnings/refresh, /api/station-calibrate; lib/job-log.js): when it started, how long it
-- took, the status it answered, the error text if it threw, and a compact summary of its answer
-- (counts; for the station calibration a tally of the skip reasons). pg_net keeps the HTTP
-- answers of pg_cron's calls only a few hours, so a failed night run was invisible by morning
-- (2026-11-09); with this table a read-only check covers any night. The cleanup job removes
-- rows after 14 days. Row level security on, no policies, no grants for the public API roles,
-- like every other table. Safe to run more than once.
create table if not exists public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null,
  duration_ms integer not null,
  status_code integer not null,
  error text,
  summary jsonb
);
create index if not exists job_runs_job_started_at on public.job_runs (job, started_at desc);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;
-- the server routes' role, not left to the project's default grants
grant select, insert, delete on public.job_runs to service_role;

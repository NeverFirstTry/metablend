-- Android tester sign-ups from /testers (POST /api/testers/signup); the owner
-- exports them as a Play Console email list and marks them as they go
-- (/api/testers/export). Written only by those server routes with the
-- service-role key: row level security on, no policies, no grants for the
-- public API roles — like every other table. Safe to run more than once.
create table if not exists public.tester_signups (
  -- trimmed and lower-cased by the route; one row per address
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  phone_model text check (char_length(phone_model) <= 60),
  country text check (char_length(country) <= 60),
  language text not null default 'en' check (char_length(language) <= 10),
  -- new → added (on the Play list) → opted_in; removed = taken off the list
  status text not null default 'new' check (status in ('new', 'added', 'opted_in', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tester_signups_status_idx on public.tester_signups (status, created_at);
alter table public.tester_signups enable row level security;
revoke all on public.tester_signups from anon, authenticated;

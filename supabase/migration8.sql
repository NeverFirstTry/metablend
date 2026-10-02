-- Hiking v2: OSM routes per peak, cached a week (OSM API usage policy), and
-- the route a planned hike is walked on.
create table if not exists public.route_cache (
  peak_key text primary key,
  routes jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.route_cache enable row level security;
alter table public.hike_plans add column if not exists route jsonb;

-- EMERGENCY LEVER. NOT RUN, neither on dev nor on production (owner, 2026-11-12: "A not now. It is
-- our emergency lever if the database passes 420 MB."). Run it only when the owner decides to.
-- It is not part of the dev schema (scripts/lib/dev-schema.mjs) and no job runs it.
--
-- What it does: thins the summits table.
--   stays: every hut; every peak with a notability mark (Wikipedia, Wikidata or a summit cross);
--          every peak in AT, DE, CH, IT, SI, FR, LI
--   goes:  a peak without any mark that lies outside those seven countries, or has no country
-- Counted on 2026-11-12 (dev and production hold the same rows): 316,865 of 568,262 rows go and
-- 251,397 stay (24,251 huts, 142,160 marked peaks, 84,986 unmarked peaks in the seven countries).
-- A copy of the kept rows with all five indexes measured 87 MB on dev. The table is 206 MB on
-- production, so about 119 MB come back.
-- The price: an unmarked hill outside the seven countries is no longer found by the search, by
-- "Near you" or around a town. The table is read by those three only (lib/places/db.js), never by id.
--
-- Order: dev first, then production. In the same hour set LEAN = true in lib/places/rows.js and
-- merge it, or the next half-yearly refresh (2 January, 2 July) loads the rows back.
-- The rule below and keepLean() in lib/places/rows.js are the same rule; supabase/summits-lean.test.js
-- runs this file's DELETE in a real Postgres and compares.

-- 1. What would go (read-only). Expect 316865 while the data is that of 2026-11-12.
select count(*) as would_go, (select count(*) from public.summits) as all_rows
  from public.summits
  where kind = 'peak' and notability = 0 and (country is null or country not in ('AT', 'DE', 'CH', 'IT', 'SI', 'FR', 'LI'));

-- 2. Trial without a change (optional): run these four lines together; the numbers come back and
--    the rollback undoes the delete.
-- begin;
-- delete from public.summits where kind = 'peak' and notability = 0 and (country is null or country not in ('AT', 'DE', 'CH', 'IT', 'SI', 'FR', 'LI'));
-- select count(*) as left_rows, count(*) filter (where kind = 'hut') as huts from public.summits;
-- rollback;

-- 3. The delete.
delete from public.summits
  where kind = 'peak' and notability = 0 and (country is null or country not in ('AT', 'DE', 'CH', 'IT', 'SI', 'FR', 'LI'));

-- 4. Give the space back. Run this line ON ITS OWN (it cannot run together with other statements).
--    It writes the table and its indexes anew; the search and "Near you" wait while it runs (the
--    table is locked), so pick a quiet hour. It needs about 90 MB of free space for the new copy.
-- vacuum full public.summits;

-- 5. Afterwards: fresh statistics, and the sizes. Expect 251397 rows and about 87 MB.
analyze public.summits;
select count(*) as rows_left, pg_size_pretty(pg_total_relation_size('public.summits')) as summits,
  pg_size_pretty(pg_database_size(current_database())) as database
  from public.summits;

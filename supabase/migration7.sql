-- Supabase security advisor "function_search_path_mutable": pin the search
-- path of the two batch functions so a caller's search_path can't redirect
-- the tables they touch. Applied 2026-10-02.
alter function public.bump_api_stats(rows jsonb) set search_path = public, pg_temp;
alter function public.mark_outlook_verified(rows jsonb) set search_path = public, pg_temp;

// Which database a run talks to (pure — unit tested). Local development uses
// its own Supabase project (.env.local); the production project is written
// only by the deployed site (VERCEL=1) or by an admin script after its owner
// confirmed it (scripts/lib/production.mjs sets METABLEND_PRODUCTION_CONFIRMED
// to the project ref). A local server, script or test that still points at
// production can read it, but every write is refused — 2026-10-27 a local
// check overwrote production rows.
export const PRODUCTION_REF = 'loxstrespghksbnprovp'

export const isProductionUrl = url => typeof url === 'string' && url.includes(`//${PRODUCTION_REF}.supabase.co`)

export const writeBlocked = (url, env) =>
  isProductionUrl(url) && env.VERCEL !== '1' && env.METABLEND_PRODUCTION_CONFIRMED !== PRODUCTION_REF

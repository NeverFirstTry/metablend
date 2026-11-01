// Which database a run talks to (pure — unit tested). Local development uses
// its own Supabase project (.env.local); the production project is written
// only by the deployed site (VERCEL_ENV production or preview — VERCEL=1 alone
// is what `vercel env pull` writes into a local file) or by an admin script after its owner
// confirmed it (scripts/lib/production.mjs sets METABLEND_PRODUCTION_CONFIRMED
// to the project ref). A local server, script or test that still points at
// production can read it, but every write is refused — 2026-10-27 a local
// check overwrote production rows.
export const PRODUCTION_REF = 'loxstrespghksbnprovp'

export const isProductionUrl = url => typeof url === 'string' && url.includes(`//${PRODUCTION_REF}.supabase.co`)

// shortcut: a `vercel env pull --environment=production` file would carry
// VERCEL_ENV=production too; the secrets are "sensitive" (not pullable), so
// such a file holds no service key — revisit if that ever changes
const DEPLOYED = new Set(['production', 'preview'])

export const writeBlocked = (url, env) =>
  isProductionUrl(url) && !DEPLOYED.has(env.VERCEL_ENV) && env.METABLEND_PRODUCTION_CONFIRMED !== PRODUCTION_REF

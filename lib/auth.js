// Shared helpers for protecting internal / cron / admin job endpoints.
import { createHash, timingSafeEqual } from 'node:crypto'

// Client IP from the standard proxy headers (Vercel sets x-forwarded-for).
export function clientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

// Constant-time comparison (digests first, so the lengths match); an unset or
// empty secret never matches.
export function secretMatches(provided, secret) {
  if (!secret || typeof provided !== 'string' || !provided) return false
  const digest = s => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(provided), digest(secret))
}

const bearerOf = request => (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()

// Authorizes background-job endpoints (backup, calibrate, cleanup, webhook).
// Vercel cron invocations carry `Authorization: Bearer $CRON_SECRET`; admins
// may pass the calibrate secret instead. Fails closed: with neither secret
// configured nobody gets in.
export function isAuthorizedJob(request) {
  const bearer = bearerOf(request)
  if (secretMatches(bearer, process.env.CRON_SECRET)) return true
  const calSecret = process.env.CALIBRATE_SECRET
  return secretMatches(request.headers.get('x-calibrate-key') ?? '', calSecret) || secretMatches(bearer, calSecret)
}

// Jobs triggered by pg_cron / an external scheduler with the calibrate key
// (push dispatch, station calibration): null when the key is configured and
// matches, else the response to send — 503 when the server has no key at all.
export function jobKeyProblem(request) {
  const secret = process.env.CALIBRATE_SECRET
  if (!secret) return { status: 503, error: 'CALIBRATE_SECRET is not configured on the server.' }
  // header-only: a query param would end up in access / proxy logs
  const provided = request.headers.get('x-calibrate-key') ?? bearerOf(request)
  return secretMatches(provided, secret) ? null : { status: 401, error: 'Unauthorized' }
}

// The site's own server-to-server reads (the app widget fetching forecast,
// outlook and summit forecast through the CDN). They all leave from Vercel's
// few egress IPs, so the per-IP limiters would count every city as one
// visitor; they carry the calibrate secret instead.
export function isInternal(request) {
  return secretMatches(request.headers.get('x-calibrate-key') ?? '', process.env.CALIBRATE_SECRET)
}

// Where the site fetches itself (often with a secret): the public domain on
// Vercel — deployment URLs 401 server-to-server fetches — else this machine.
// Never a host taken from the request: a forged Host header could send the
// secret elsewhere.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
export function selfBase(request) {
  if (process.env.VERCEL_ENV) return 'https://metablend.app'
  const u = new URL(request.url)
  return LOCAL_HOSTS.has(u.hostname) ? u.origin : 'http://localhost:3000'
}

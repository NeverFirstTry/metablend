// Shared helpers for protecting internal / cron / admin job endpoints.
import { createHash, timingSafeEqual } from 'node:crypto'

// The visitor's address as every limit counts it, from the standard proxy headers (Vercel sets
// x-forwarded-for): an IPv6 line as one address, a value that is no address as one fixed name (addressGroup).
export function clientIp(request) {
  return addressGroup(
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

// An IPv6 line is a whole block of addresses (a /64) and its owner can ask from any of them, so they
// count as one (review of 2026-11-14: counted singly, the limit meant nothing to anyone with IPv6).
// An IPv4 address written the IPv6 way (::ffff:203.0.113.7) is that IPv4 address.
// A value that is no address (the header it comes from is the platform's on Vercel, a client's anywhere
// else) counts under one fixed name: it can never come out as 'own', the name of the site's own jobs
// (security review, 2026-11-20).
export function addressGroup(ip) {
  if (!/^[0-9a-f:.]+$/i.test(ip)) return 'not-an-address'
  if (!ip.includes(':')) return ip
  const v4 = ip.match(/:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) return v4[1]
  const [head, tail] = ip.split('::')
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : []
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t]
  return `${groups.slice(0, 4).map(g => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`
}

// What one of our own readers (the widget feed, the share card) sends when it asks our own addresses for a
// visitor: the server's key, which lifts the per-visitor limits for it, and the visitor's address, so that
// what is counted by address is counted for that visitor (lib/last-answer.js asker). No key: nothing.
export const ownHeaders = request => {
  const key = process.env.CALIBRATE_SECRET
  return key ? { 'x-calibrate-key': key, 'x-visitor': clientIp(request) } : {}
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

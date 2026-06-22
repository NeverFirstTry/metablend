// Shared helpers for protecting internal / cron / admin job endpoints.

// Client IP from the standard proxy headers (Vercel sets x-forwarded-for).
export function clientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

// Authorizes background-job endpoints (calibrate, cleanup, webhook).
//
// Vercel cron invocations carry `Authorization: Bearer $CRON_SECRET` once the
// CRON_SECRET env var is set on the project. Admins — and the app's own internal
// fetches — may also pass the calibrate secret. Until CRON_SECRET is configured
// the endpoints stay open, so the existing crons keep working with no env change;
// set CRON_SECRET in the environment to lock them down.
export function isAuthorizedJob(request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  if (bearer && bearer === cronSecret) return true

  // Allow manual admin triggering with the calibrate secret too.
  const calSecret = process.env.CALIBRATE_SECRET
  const headerKey = request.headers.get('x-calibrate-key') ?? ''
  if (calSecret && (headerKey === calSecret || bearer === calSecret)) return true

  return false
}

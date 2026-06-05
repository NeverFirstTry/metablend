import { supabase } from './supabase.js'

// Lightweight error logging for the beta. Always writes to the server console
// (captured by Vercel's logs/observability), and best-effort persists a row to
// the error_log table so recent failures are queryable without digging through
// dashboards. Never throws — logging must not break a request.
export async function logError(scope, error, meta = {}) {
  const message = error?.message ?? String(error)
  console.error(`[${scope}]`, message, Object.keys(meta).length ? meta : '')
  try {
    await supabase.from('error_log').insert({
      scope,
      message: String(message).slice(0, 2000),
      meta: { ...meta, stack: error?.stack?.slice(0, 2000) ?? null },
    })
  } catch { /* best-effort: never let logging surface an error */ }
}

// Wrap a route handler so any unexpected throw is logged (with context) and
// turned into a clean 500 instead of an opaque crash. Usage:
//   export const GET = withErrorLog('forecast', async (request) => { … })
export function withErrorLog(scope, handler) {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx)
    } catch (err) {
      await logError(scope, err, { url: request?.url })
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }
  }
}

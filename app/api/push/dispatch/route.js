import { withErrorLog, logError } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { runDispatch } from '@/lib/push/dispatch'
import * as store from '@/lib/push/store'
import { senderFromEnv } from '@/lib/push/send'
import { getRegion } from '@/lib/weather'
import { loadOutlookWeights } from '@/lib/outlook/weights'
import { getJson as outlookGetJson } from '@/lib/outlook/http'
import { fetchElevations } from '@/lib/hike/sources'
import { routeWeather } from '@/lib/route/weather'

// Hourly from pg_cron (supabase/cron.sql, job push-dispatch-hourly), and every
// 15 minutes with ?only=rain (job push-dispatch-nowcast), with the calibrate
// secret from Vault — same gate as /api/station-calibrate.
// ?dry=1 lists what would be sent right now without sending anything.
export const maxDuration = 300

// our own endpoints, with the server key: outlook / summit / nowcast skip
// their per-visitor limits for it (one run asks for every home city)
async function getJson(url) {
  const key = process.env.CALIBRATE_SECRET
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: key ? { 'x-calibrate-key': key } : {} })
    if (!r.ok) return null
    const j = await r.json()
    return j?.error ? null : j
  } catch { return null }
}

// weather along a planned route, with the same regional weights as /api/route-weather
async function routeWeatherFor(q) {
  const weights = await loadOutlookWeights(getRegion(q.points[0].lat, q.points[0].lon))
  return routeWeather(q, { getJson: outlookGetJson, getElevations: fetchElevations, weights })
}

export const GET = withErrorLog('push.dispatch', async (request) => {
  const denied = jobKeyProblem(request) // no key configured → nobody can trigger sends
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })
  const sp = new URL(request.url).searchParams
  const dry = sp.get('dry') === '1'
  const only = sp.get('only') === 'rain' ? 'rain' : null
  const summary = await runDispatch({ store, getJson, sender: senderFromEnv(), dry, routeWeather: routeWeatherFor, only })
  if (summary.failed) await logError('push.dispatch', new Error(`${summary.failed} sends failed`), { errors: summary.errors })
  return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } })
})

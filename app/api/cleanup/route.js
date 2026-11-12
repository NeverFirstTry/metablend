import { supabase } from '@/lib/supabase'
import { readAll } from '@/lib/push/paging'
import { deltaFromDiff, median } from '@/lib/scoring'
import { applyDeltas, claimDay } from '@/lib/weights'
import { isAuthorizedJob } from '@/lib/auth'
import { withErrorLog, logError } from '@/lib/log'
import { withJobLog } from '@/lib/job-log'
import { runOutlookVerification } from '@/lib/outlook/job'
import { CACHE_DAYS as NOMINATIM_DAYS } from '@/lib/hike/nominatim'
import { NOTE_SCOPES } from '@/lib/health'
import { purgeShortLived } from '@/lib/retention'

// Meteostat lookups, weight round-trips per city and the outlook's METAR
// verification take a while: the default 300 s that every route shares
// (one function — fewer cold starts) gives it room.

// Cap cities per run to respect RapidAPI request limits (~500/month on basic plan)
const MAX_CITIES = 10

// How long the logs are kept (owner, 2026-11-12). Nothing reads blend history
// older than a day (RSS: 24 h, intraday chart: today, webhook: 1 h); the health
// address reads 15 minutes of the error log, the weekly reports two weeks; the
// station log is read by reports only. Notes in the error log (a place asked
// from the geocoder, the quota note, a feed note) are not failures and go sooner.
const HISTORY_DAYS = 7 // consensus_history
const ERROR_DAYS = 14 // error_log
const NOTE_DAYS = 7 // error_log rows with a scope in NOTE_SCOPES
const STATION_DAYS = 14 // station_errors
const RETENTION_DAYS = 30 // the feedback lesson counters
const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString()

// ── Meteostat (RapidAPI) ──────────────────────────────────────────────────────
async function fetchMeteostat(lat, lon, date) {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return null
  const url = `https://meteostat.p.rapidapi.com/point/daily?lat=${lat}&lon=${lon}&start=${date}&end=${date}`
  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'meteostat.p.rapidapi.com',
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.[0] ?? null   // { tavg, tmin, tmax, prcp, wspd, wdir, … }
  } catch {
    return null
  }
}

// ── Historical validation ─────────────────────────────────────────────────────
async function runMeteostatValidation() {
  // Visual Crossing (the 6am /api/calibrate cron) is the primary daily scorer.
  // Only score against Meteostat when VC isn't configured, so each day's
  // forecasts count once — not twice against two different ground truths.
  if (process.env.VISUAL_CROSSING_KEY) {
    return { skipped: 'daily scoring handled by /api/calibrate (Visual Crossing)' }
  }
  if (!process.env.RAPIDAPI_KEY) return { skipped: 'RAPIDAPI_KEY not configured' }

  // valid_for is the city-local date; Meteostat daily data is local too.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  // Never the same day twice — claimed before any work (lib/weights.js claimDay)
  if (!(await claimDay('__meteostat__', yesterday))) return { skipped: 'already validated', date: yesterday }

  // Fetch all of yesterday's stored forecasts, oldest first so "last row wins"
  // below really is the latest per API — every page: one request stops at 1000.
  const forecasts = await readAll((from, to) => supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, region, created_at')
    .eq('valid_for', yesterday)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to))

  if (!forecasts?.length) return { skipped: 'no forecasts for yesterday', date: yesterday }

  // Unique cities, capped at MAX_CITIES
  const seenCities = new Set()
  const cities = []
  for (const f of forecasts) {
    if (!seenCities.has(f.city) && cities.length < MAX_CITIES) {
      seenCities.add(f.city)
      cities.push({ city: f.city, lat: f.lat, lon: f.lon, region: f.region ?? 'global' })
    }
  }

  const results = []
  let validated = 0

  for (const { city, lat, lon, region } of cities) {
    // Fetch actual weather from Meteostat
    const actual = await fetchMeteostat(lat, lon, yesterday)
    if (actual?.tavg == null) {   // == null, not falsy — 0°C is a valid average
      results.push({ city, skipped: 'no Meteostat data' })
      continue
    }

    const actualTemp = actual.tavg  // daily average – best single comparison point

    // latest stored forecast per API for this city
    const latestPerApi = {}
    forecasts.filter(f => f.city === city).forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)

    // Median forecast temp across all APIs — used to flag outliers, same as
    // the feedback/calibrate routes.
    const medianTemp = median(unique.map(f => f.temp))

    // Score each API's forecast against the actual daily average.
    // Thresholds are wider than user-feedback (2/4/6/8°) because we're
    // comparing an instantaneous forecast against a 24-h mean.
    const deltaMap = {}
    for (const fc of unique) {
      const diff = Math.abs(fc.temp - actualTemp)
      deltaMap[fc.api_id] = Math.abs(fc.temp - medianTemp) > 5
        ? -2
        : deltaFromDiff(diff, 'daily')
    }

    const applied = await applyDeltas(region, deltaMap)
    if (!applied) continue

    results.push({
      city,
      actualTemp,
      apis: applied.map(u => ({ id: u.id, delta: u.deltas[0] })),
    })
    validated++
  }


  return { validated, date: yesterday, results }
}

// ── GET handler ───────────────────────────────────────────────────────────────
export const GET = withErrorLog('cleanup', withJobLog('cleanup', async (request) => {
  if (!isAuthorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()

  const deletes = await Promise.all([
    supabase.from('forecasts').delete().lt('created_at', cutoff),
    // WeatherAPI's terms cap its current conditions at 60 minutes: the hourly station calibration
    // purges its rows; this catches a missed run (lib/retention.js)
    purgeShortLived(supabase, new Date(Date.now() - 60 * 60 * 1000).toISOString()).then(() => ({ error: null }), error => ({ error })),
    // Only the job sentinels age out. Real community reports stay — they feed
    // the heatmap, which is pointless with a 48-hour memory.
    supabase.from('feedback').delete().lt('created_at', cutoff)
      .in('actual_cond', ['__calibrate__', '__meteostat__']),
    supabase.from('consensus_history').delete().lt('created_at', daysAgo(HISTORY_DAYS)),
    supabase.from('error_log').delete().lt('created_at', daysAgo(ERROR_DAYS)),
    supabase.from('error_log').delete().lt('created_at', daysAgo(NOTE_DAYS)).in('scope', NOTE_SCOPES),
    // push: phones unseen for 90 days, hikes after their day, the 14-day send log
    supabase.from('push_devices').delete().lt('last_seen', new Date(Date.now() - 90 * 86_400_000).toISOString()),
    supabase.from('hike_plans').delete().lt('date', new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)),
    supabase.from('push_log').delete().lt('sent_at', new Date(Date.now() - 14 * 86_400_000).toISOString()),
    // caches past their use: routes are looked up again after a week, Nominatim answers after 30 days
    supabase.from('route_cache').delete().lt('fetched_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    supabase.from('nominatim_cache').delete().lt('fetched_at', new Date(Date.now() - NOMINATIM_DAYS * 86_400_000).toISOString()),
  ])

  // Kept apart from the list above: the shadow run's table may not exist yet, or may already be dropped.
  const shadow = await supabase.from('station_errors').delete().lt('created_at', daysAgo(STATION_DAYS))
  if (shadow.error && shadow.error.code !== 'PGRST205') await logError('cleanup.station-errors', shadow.error)
  // the feedback lesson counters (one row per region and day): a month is plenty; the table may not exist yet either
  const lessonDays = await supabase.from('feedback_lesson_days').delete().lt('day', retentionCutoff.slice(0, 10))
  if (lessonDays.error && lessonDays.error.code !== 'PGRST205') await logError('cleanup.lesson-days', lessonDays.error)
  // the jobs' run log (lib/job-log.js): two weeks; the table may not exist yet either
  const jobRuns = await supabase.from('job_runs').delete().lt('started_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
  if (jobRuns.error && jobRuns.error.code !== 'PGRST205') await logError('cleanup.job-runs', jobRuns.error)
  // our Open-Meteo request count (lib/open-meteo.js): 90 days; the table may not exist yet either
  const omCalls = await supabase.from('open_meteo_calls').delete().lt('day', new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10))
  if (omCalls.error && omCalls.error.code !== 'PGRST205') await logError('cleanup.open-meteo-calls', omCalls.error)
  // Open-Meteo's geocoding answers we keep (lib/geocode.js): 30 days; the table may not exist yet either
  const geocodes = await supabase.from('geocode_cache').delete().lt('fetched_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
  if (geocodes.error && geocodes.error.code !== 'PGRST205') await logError('cleanup.geocode-cache', geocodes.error)
  // a place's climate table (lib/climate-store.js) is asked again after a year; one nobody asked for since goes after 400 days
  const climates = await supabase.from('place_climate').delete().lt('fetched_at', new Date(Date.now() - 400 * 86_400_000).toISOString())
  if (climates.error && climates.error.code !== 'PGRST205') await logError('cleanup.place-climate', climates.error)

  let validation
  try {
    validation = await runMeteostatValidation()
  } catch (e) {
    await logError('meteostat.validate', e)
    validation = { error: e.message }
  }

  // Outlook learning: check the saved predictions whose time has come
  let outlook
  try {
    outlook = await runOutlookVerification()
  } catch (e) {
    await logError('outlook.verify', e)
    outlook = { error: e.message }
  }

  const failed = deletes.find(d => d.error)
  if (failed) {
    return Response.json({ error: failed.error.message, validation, outlook }, { status: 500 })
  }

  return Response.json({ ok: true, cutoff, retentionCutoff, validation, outlook })
}))

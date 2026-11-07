import { supabase } from '@/lib/supabase'
import { readAll } from '@/lib/push/paging'
import { median, deltaFromDiff, rawErrors } from '@/lib/scoring'
import { applyDeltas } from '@/lib/weights'
import { updateCityBias, shownConsensus } from '@/lib/blend'
import { withErrorLog, logError } from '@/lib/log'
import { jobKeyProblem } from '@/lib/auth'
import { haversineKm } from '@/lib/geo'
import { localHourIso } from '@/lib/localtime'
import { parseSummitMulti } from '@/lib/hike/parse'
import { OM_MODELS } from '@/lib/outlook/models'
import { SUMMITS, nearestStation, chooseTruth, summitErrors, stationTemps } from '@/lib/shadow'

// Ground-truth calibration from aviation METAR observations (NOAA Aviation
// Weather Center — free, no key). For each city with a recent forecast, pull
// every METAR in a bounding box around it, take the median temperature of the
// nearest fresh reports as ground truth, and re-weight every API's stored
// forecast against it — same delta/normalization the feedback route uses.
// Replaced Weather Underground PWS, which required a key we never had, so the
// hourly calibration had been silently skipping since launch.

// METARs are prefetched in parallel and weights persist as one batch upsert,
// and 15 cities of DB work once outgrew a short limit (a run 504ed when
// traffic picked up) — the shared 300 s default gives it real headroom.

const RADIUS_KM = 60           // METAR stations (airports) are sparser than PWS
const LOOKBACK_MIN = 60        // only score forecasts stored in the last hour
const MAX_CITIES = 15          // cap per run out of courtesy to the free API
const MAX_STATIONS = 4         // nearest N fresh reports (median of these)
const MAX_OBS_AGE_MIN = 90     // METARs are hourly; skip anything staler

// Fresh METAR observations within RADIUS_KM of the point, nearest first.
// Returns { temps, winds, km } — temps in °C, winds in km/h (METAR wspd is knots),
// km to the nearest report.
async function metarObs(lat, lon) {
  const bbox = `${(lat - 0.7).toFixed(2)},${(lon - 1.0).toFixed(2)},${(lat + 0.7).toFixed(2)},${(lon + 1.0).toFixed(2)}`
  try {
    const res = await fetch(`https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { temps: [], winds: [] }
    const reports = await res.json()
    if (!Array.isArray(reports)) return { temps: [], winds: [] }
    const cutoff = Date.now() - MAX_OBS_AGE_MIN * 60 * 1000
    const nearest = reports
      .filter(r => typeof r.temp === 'number' && r.lat != null && r.lon != null)
      .filter(r => !r.reportTime || new Date(r.reportTime).getTime() >= cutoff)
      .map(r => ({ ...r, distanceKm: haversineKm(lat, lon, r.lat, r.lon) }))
      .filter(r => r.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_STATIONS)
    return {
      temps: nearest.map(r => r.temp),
      winds: nearest.filter(r => typeof r.wspd === 'number').map(r => r.wspd * 1.852),
      km: nearest.length ? Math.round(nearest[0].distanceKm * 10) / 10 : null,
    }
  } catch {
    return { temps: [], winds: [] }
  }
}

// Formula shadow run (supabase/station-errors.sql): every source's raw error, also where
// no airport is near (a town's official station) and on summits with a station on top.
// The weights below don't use any of it, and until the table exists (PGRST205) there's nothing to log.
async function saveShadow(cities, forecasts, observations, since) {
  const { default: stations } = await import('@/lib/shadow-stations.json')
  const near = cities.map(c => nearestStation(stations, c.lat, c.lon))
  const ids = [...new Set([...near.filter(Boolean).map(s => s.id), ...SUMMITS.map(s => s.station)])]
  const res = await fetch(`https://dataset.api.hub.geosphere.at/v1/station/current/tawes-v1-10min?parameters=TL&station_ids=${ids.join(',')}`, { signal: AbortSignal.timeout(8000) }).catch(() => null)
  const temps = stationTemps(res?.ok ? await res.json() : null)

  const rows = []
  for (const [i, { city, region }] of cities.entries()) {
    const reading = chooseTruth({ stationTemp: temps.get(near[i]?.id), stationKm: near[i]?.km, metarTemps: observations[i].temps, metarKm: observations[i].km })
    if (!reading) continue
    const latest = {}
    forecasts.filter(f => f.city === city).forEach(f => { latest[f.api_id] = f })
    rows.push({ city, region, truth: reading.truth, truth_km: reading.km ?? null, actual: reading.actual, shown: await shownConsensus(city, since), errors: rawErrors(Object.values(latest), reading.actual) })
  }
  await Promise.all(SUMMITS.filter(s => temps.has(s.station)).map(async s => {
    // temperature only, one day: the app's summit request is far bigger than this needs
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&elevation=${s.elev}&hourly=temperature_2m&models=${OM_MODELS.map(m => m.model).join(',')}&forecast_days=1&timezone=auto`
    const answer = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null)
    const parsed = answer?.ok ? parseSummitMulti(await answer.json().catch(() => null)) : null // one bad body costs one summit, not the hour
    if (!parsed) return
    const actual = temps.get(s.station)
    const errors = summitErrors(parsed, localHourIso(parsed.utcOffsetSec).slice(0, 13), actual)
    if (Object.keys(errors).length) rows.push({ city: s.name, region: 'europe', truth: 'summit', truth_km: 0, actual, shown: null, errors })
  }))
  if (!rows.length) return
  const { error } = await supabase.from('station_errors').insert(rows)
  if (error && error.code !== 'PGRST205') await logError('station-errors', error)
}

export const GET = withErrorLog('station-calibrate', async (request) => {
  // Triggered by an external scheduler (GitHub Action / cron-job.org) rather than
  // a Vercel cron: needs CALIBRATE_SECRET, configured and matching.
  const denied = jobKeyProblem(request)
  if (denied) return Response.json({ error: denied.error }, { status: denied.status })

  const since = new Date(Date.now() - LOOKBACK_MIN * 60 * 1000).toISOString()
  // Ordered oldest-first so "last row wins" below really is the latest per API.
  // Every page: one request stops at 1000 rows.
  const forecasts = await readAll((from, to) => supabase
    .from('forecasts')
    .select('city, lat, lon, api_id, temp, wind_kmh, region, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to))
  if (!forecasts?.length) {
    // the summits need no forecast rows, so a quiet hour still records them
    await saveShadow([], [], [], since).catch(e => logError('station-errors', e))
    return Response.json({ skipped: 'no forecasts in the last hour', since })
  }

  // Unique cities (with coordinates), capped
  const seen = new Set()
  const cities = []
  for (const f of forecasts) {
    if (f.lat == null || f.lon == null) continue
    if (!seen.has(f.city) && cities.length < MAX_CITIES) {
      seen.add(f.city)
      cities.push({ city: f.city, lat: f.lat, lon: f.lon, region: f.region ?? 'global' })
    }
  }

  const results = []
  let calibrated = 0

  // The slow network part runs in parallel up front; the DB scoring below
  // stays serial on purpose — cities in the same region touch the same weight
  // rows, and concurrent read-modify-writes would drop deltas.
  const observations = await Promise.all(cities.map(c => metarObs(c.lat, c.lon)))

  for (const [i, { city, lat, lon, region }] of cities.entries()) {
    const { temps, winds } = observations[i]
    if (!temps.length) { results.push({ city, skipped: `no fresh METAR within ${RADIUS_KM}km` }); continue }
    const actualTemp = median(temps)
    const actualWind = winds.length ? median(winds) : null

    // 4. Latest stored forecast per API for this city (within the lookback window)
    const latestPerApi = {}
    forecasts.filter(f => f.city === city).forEach(f => { latestPerApi[f.api_id] = f })
    const unique = Object.values(latestPerApi)

    // Cross-API median forecast — used for the outlier guard, same as feedback
    const medForecast = median(unique.map(f => f.temp))

    // Teach MetaBlend Local from station ground truth: its error vs the
    // consensus shown (the raw-source median, our own source excluded, when
    // none was stored in the window).
    const real = unique.filter(f => f.api_id !== 'metablend')
    if (real.length) {
      const shown = await shownConsensus(city, since)
      await updateCityBias(city, lat, lon, region, actualTemp - (shown ?? median(real.map(f => f.temp))))
    }

    // 5. Score + re-weight (identical math to the feedback / calibrate routes).
    // Temperature is the primary delta; when both sides report wind, a second
    // delta on the looser 'wind' scheme rewards wind accuracy too.
    const deltaMap = {}
    for (const f of unique) {
      const tempDelta = Math.abs(f.temp - medForecast) > 5
        ? -2
        : deltaFromDiff(Math.abs(f.temp - actualTemp), 'instant')
      const deltas = [tempDelta]
      if (actualWind != null && typeof f.wind_kmh === 'number') {
        deltas.push(deltaFromDiff(Math.abs(f.wind_kmh - actualWind), 'wind'))
      }
      deltaMap[f.api_id] = deltas
    }

    const applied = await applyDeltas(region, deltaMap)
    if (!applied) continue

    results.push({
      city,
      actualTemp: Math.round(actualTemp * 10) / 10,
      actualWind: actualWind != null ? Math.round(actualWind) : null,
      stations: temps.length,
      apis: applied.map(u => ({ id: u.id, deltas: u.deltas })),
    })
    calibrated++
  }

  // the weights are saved by now: whatever happens in here can't touch them
  await saveShadow(cities, forecasts, observations, since).catch(e => logError('station-errors', e))

  return Response.json({ calibrated, since, radiusKm: RADIUS_KM, results })
})

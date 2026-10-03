// Rain in the next 2 hours: Open-Meteo's 15-minute precipitation from every
// short-range model that covers a place, blended like the rest of MetaBlend
// (median amount, majority vote, agreement). Pure — fetching lives in
// /api/nowcast; every consumer summarizes against its own "now", since the
// response is cached for 5 minutes.

export const NOWCAST_MODELS = 'best_match,icon_d2,meteofrance_arome_france_hd,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic,gfs_hrrr,ukmo_uk_deterministic_2km'
const WET_MM = 0.1
const QUARTER = 15 * 60e3
const r2 = v => Math.round(v * 100) / 100

export function parseNowcastQuery(sp) {
  const lat = Number(sp.get('lat')), lon = Number(sp.get('lon'))
  if (!sp.get('lat') || !sp.get('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat: r2(lat), lon: r2(lon) }
}

export const nowcastUrl = ({ lat, lon }) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&minutely_15=precipitation&forecast_minutely_15=10&past_minutely_15=1&timezone=auto&models=${NOWCAST_MODELS}`

const median = xs => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function blendSteps(json) {
  const m = json?.minutely_15
  if (!Array.isArray(m?.time)) return null
  const series = Object.entries(m)
    .filter(([k, v]) => (k === 'precipitation' || k.startsWith('precipitation_')) && Array.isArray(v) && v.some(x => typeof x === 'number'))
    .map(([k, v]) => [k === 'precipitation' ? 'best_match' : k.slice('precipitation_'.length), v])
  const fine = series.filter(([name]) => name !== 'best_match')
  const use = fine.length ? fine : series
  if (!use.length) return null
  const steps = m.time.map((t, i) => {
    const vals = use.map(([, v]) => v[i]).filter(x => typeof x === 'number')
    if (!vals.length) return { t, mm: null, wet: false, agree: 0 }
    const wetN = vals.filter(x => x >= WET_MM).length
    return { t, mm: r2(median(vals)), wet: wetN * 2 > vals.length, agree: r2(Math.max(wetN, vals.length - wetN) / vals.length) }
  })
  return { precision: fine.length ? 'fine' : 'rough', models: use.length, utcOffsetSec: json.utc_offset_seconds ?? 0, steps }
}

export const intensity = mm => (mm < 0.6 ? 'light' : mm < 2 ? 'moderate' : 'heavy')

const epoch = (t, off) => Date.parse(`${t}:00Z`) - off * 1000

// the current quarter and the ones after it, at most 8 (2 hours)
export function upcoming(nc, now) {
  if (!nc?.steps) return []
  const off = nc.utcOffsetSec ?? 0
  const i = nc.steps.findIndex(s => epoch(s.t, off) + QUARTER > now)
  return i < 0 ? [] : nc.steps.slice(i, i + 8)
}

const peak = steps => intensity(Math.max(...steps.map(s => s.mm ?? 0)))

export function summarize(nc, now) {
  const steps = upcoming(nc, now)
  if (steps.length < 4) return null
  const first = steps.findIndex(s => s.wet)
  if (first < 0) return { kind: 'dry' }
  if (first === 0) {
    const dryAt = steps.findIndex(s => !s.wet)
    return dryAt < 0
      ? { kind: 'all', intensity: peak(steps) }
      : { kind: 'stop', until: steps[dryAt].t, intensity: peak(steps.slice(0, dryAt)) }
  }
  const end = steps.findIndex((s, i) => i > first && !s.wet)
  const run = steps.slice(first, end < 0 ? undefined : end)
  return {
    kind: 'start', at: steps[first].t,
    minutes: Math.max(0, Math.round((epoch(steps[first].t, nc.utcOffsetSec ?? 0) - now) / 60000)),
    until: end < 0 ? null : steps[end].t, duration: end < 0 ? null : (end - first) * 15,
    intensity: peak(run), agree: steps[first].agree,
  }
}

// The rain alert from the nowcast: undefined when there is no usable
// nowcast here (rough or stale — the hourly rule decides), null when the
// nowcast says no alert, else the event.
export function nowcastRain(nc, now) {
  if (nc?.precision !== 'fine') return undefined
  const s = summarize(nc, now)
  if (!s) return undefined
  if (s.kind !== 'start' || s.minutes < 10 || s.minutes > 60 || s.agree < 0.66) return null
  return { from: s.at, minutes: s.minutes, duration: s.duration, intensity: s.intensity, nowcast: true }
}

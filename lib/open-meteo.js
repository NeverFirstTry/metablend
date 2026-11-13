// Every request to Open-Meteo goes through the gate here (lib/weather.js tfetch, lib/outlook/http.js
// getJson, the two direct calls): one gate and one note of what was refused. It also notices
// the one answer that changes how we cache: a 429 whose reason says the daily limit is used up. That
// limit resets at midnight UTC and is per IP, so until then no Open-Meteo source comes back and a blend
// missing them is kept its full 15 minutes (lib/forecast-cache.js) instead of being refetched every 2
// minutes against a wall.
import { supabase } from './supabase.js'
import { logError } from './log.js'
import { makeGate } from './hike/gate.js'

// the public service's hosts: open-meteo.com and its subdomains, nothing that merely ends in those letters
export const isOpenMeteo = url => { try { const h = new URL(url).hostname; return h === 'open-meteo.com' || h.endsWith('.open-meteo.com') } catch { return false } }

let limitedUntil = 0 // ms; the next midnight UTC after a daily-limit answer

export const nextUtcMidnight = now => { const d = new Date(now); d.setUTCHours(24, 0, 0, 0); return d.getTime() }

// what an Open-Meteo answer said: a 429 with "daily" in its reason marks the limit as reached
export function noteAnswer(url, status, reason = '', now = Date.now()) {
  if (status === 429 && /daily/i.test(String(reason)) && isOpenMeteo(url)) limitedUntil = Math.max(limitedUntil, nextUtcMidnight(now))
}

export const dailyLimited = (now = Date.now()) => now < limitedUntil

// for tests: forget a noted limit
export const resetLimit = () => { limitedUntil = 0 }

// ── counting ──────────────────────────────────────────────────────────────────────────────────
// Open-Meteo's own rule (their pricing FAQ): one API call per request; more than 10 weather variables
// or more than two weeks for one location count fractionally, 15 variables over 2 weeks = 1.5 calls,
// over 4 weeks = 3.0. Several locations in one request and several models are not covered there, so
// every location, and every model's set of variables, counts as its own here (the conservative reading).
export function callWeight(url) {
  let u
  try { u = new URL(url) } catch { return 1 }
  const p = u.searchParams
  const list = k => (p.get(k) ?? '').split(',').filter(Boolean)
  const locations = Math.max(1, list('latitude').length)
  if (u.pathname.includes('/elevation')) return locations
  const variables = ['hourly', 'daily', 'current', 'minutely_15', 'current_weather'].reduce((n, k) => n + list(k).length, 0) || 1
  const models = Math.max(1, list('models').length)
  let days = Number(p.get('forecast_days')) || 7
  if (p.get('start_date') && p.get('end_date')) days = Math.max(1, Math.round((Date.parse(p.get('end_date')) - Date.parse(p.get('start_date'))) / 86_400_000) + 1)
  // per place at least one call; the long span multiplies before that floor, as their calculator does
  // (open-meteo.com/en/pricing, checked 2026-11-11: 2 daily values over 10 years are 52.2 calls, not 261)
  return Math.round(locations * Math.max(1, variables * models / 10 * Math.max(1, days / 14)) * 100) / 100
}

export const DAILY_LIMIT = 10000
const ALERT_AT = [0.7, 0.9]
let alerted = { day: '', levels: new Set() }
export const resetAlerts = () => { alerted = { day: '', levels: new Set() } }

// the message for a threshold crossed for the first time this UTC day (90 covers 70), else null
export function quotaAlert(dayTotal, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10)
  if (alerted.day !== day) alerted = { day, levels: new Set() }
  for (const level of [...ALERT_AT].reverse()) {
    if (dayTotal >= DAILY_LIMIT * level && !alerted.levels.has(level)) {
      ALERT_AT.filter(l => l <= level).forEach(l => alerted.levels.add(l))
      return `Open-Meteo: ${Math.round(dayTotal)} of ${DAILY_LIMIT} daily calls used (${Math.round(level * 100)} %) by ${new Date(now).toISOString().slice(11, 16)} UTC`
    }
  }
  return null
}

// one bump per request in its UTC hour and of its kind (open_meteo_calls, supabase/open-meteo-calls.sql),
// fire and forget: never in the request's way, a missing table or function is ignored. The kind is
// who asked: forecast, geocoding, outlook, summit, summit-page (the summit pages' stored copy), nowcast,
// route, heights, planner, shadow, climate.
export function countRequest(url, { kind = 'other', calls = callWeight(url), db = supabase, now = Date.now(), log = logError } = {}) {
  const d = new Date(now)
  return Promise.resolve()
    .then(() => db.rpc('bump_open_meteo_calls', { p_day: d.toISOString().slice(0, 10), p_hour: d.getUTCHours(), p_calls: calls, p_kind: kind }))
    .then(({ data, error }) => {
      if (error) { if (!['PGRST202', 'PGRST205'].includes(error.code)) console.error('[open-meteo count]', error.message); return }
      const msg = quotaAlert(Number(data), now)
      if (msg) return log('open-meteo.quota', new Error(msg), { day: d.toISOString().slice(0, 10), calls: Number(data) })
    })
    .catch(e => console.error('[open-meteo count]', e?.message ?? e))
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────────
// At most four requests to Open-Meteo in flight per instance, the rest wait their turn; callers asking
// the same URL while it is in flight share that one request, each with its own copy of the answer.
// Open-Meteo refuses bursts with 429 "Too many concurrent requests", per IP, and Vercel's addresses are
// shared with others: a forecast miss asked eight at once and lost its ten-model request (Vienna,
// 2026-11-10), twenty cities at once lost sixteen blends. The summit path had this gate to itself
// (2026-11-09) and its refusals went from 47 a day to none.
// A caller's time limit (timeoutMs) starts when its request leaves the queue, not while it waits its
// turn: in a burst the last in line would spend its seconds waiting and give up without having asked.
// The wait has its own limit, 10 s: a request still without a turn then fails (GateWaitError, in the
// thin-blend log like any other failure), so a flood of places cannot hold requests open without end.
// Twenty places at once wait about 3 s at Open-Meteo's usual speed.
const gate = makeGate((url, { timeoutMs, ...init } = {}) => fetch(url, timeoutMs ? { ...init, signal: AbortSignal.timeout(timeoutMs) } : init), 4, 10_000)

// why a request gave nothing, for the log that has to say so (forecast.partial): the last 60
const failures = []
const said = body => { try { return JSON.parse(body).reason ?? body } catch { return body } }
function noteFailure(url, status, reason) {
  failures.push({ at: Date.now(), url: String(url), status, reason: String(reason).slice(0, 120) })
  if (failures.length > 60) failures.shift()
}
// the failed requests since a moment whose URL holds `part` (a spot's "latitude=…&longitude=…"): status
// (0: no answer), the reason given, and which request it was (its models, else what it asked)
export function failuresSince(since, part = '') {
  return failures.filter(f => f.at >= since && f.url.includes(part)).map(({ url, status, reason }) => {
    const p = new URL(url).searchParams
    const asked = p.get('models') ?? ['current', 'hourly', 'minutely_15', 'daily'].map(k => p.get(k)).find(Boolean) ?? new URL(url).pathname
    return { status, reason, request: asked.length > 60 ? `${asked.slice(0, 57)}...` : asked }
  })
}

// fetch through the gate, a refusal or failure noted; the body of a refusal is read from a copy so the
// caller still gets it
export async function gatedFetch(url, init) {
  let res
  try {
    res = (await gate(String(url), init)).clone()
  } catch (e) {
    noteFailure(url, 0, e?.name ?? 'Error')
    throw e
  }
  if (!res.ok) {
    const reason = said(await res.clone().text().catch(() => ''))
    if (res.status === 429) noteAnswer(url, 429, reason)
    noteFailure(url, res.status, reason)
  }
  return res
}

// the same, counted (open_meteo_calls): the forecast's sources, the station calibration and everything
// getJson asks any Open-Meteo host (outlook, nowcast, summits, route weather, heights, the peak search's
// geocoding, and since 2026-11-11 the archive host for a place's climate table). Counted when asked, so
// the figure is an upper bound: a request Next answers from its own cache (route weather 15 min, heights
// a day) or that shares another's answer in the gate is counted as well.
export function openMeteoFetch(url, { kind, ...init } = {}) {
  const self = selfUrl(url)
  const share = self ? shadowShare() : 0
  if (self && !share && !selfPaused()) return viaSelf(url, self, kind, init)
  if (publicOff()) return refuse(url, self ? 'SelfPaused' : 'PublicOff')
  void countRequest(url, { kind })
  const answer = gatedFetch(url, init)
  // the comparison run: the caller gets the public answer as always; a copy of it goes to the comparison
  if (share && Math.random() < share) answer.then(res => { if (res.ok) keepAlive(mirror(url, self, kind, res.clone())) }).catch(() => {})
  return answer
}

// ── our own server ────────────────────────────────────────────────────────────────────────────
// OPEN_METEO_SELF (https://host, no path): our own Open-Meteo server. Set, a request to one of the
//   hosts in ON_SELF goes there first, same path and question. Unset, nothing changes.
// OPEN_METEO_PUBLIC=off: the public service is never asked (its free tier is for non-commercial use;
//   set for good at launch). What our server cannot answer then fails, like any failed source.
// OPEN_METEO_SELF_ID, OPEN_METEO_SELF_SECRET: the Cloudflare Access service token of the tunnel in
//   front of our server (headers CF-Access-Client-Id and CF-Access-Client-Secret). They go to that
//   address only, and a redirect is refused, so they cannot follow one to another address.
// OPEN_METEO_SELF_TIMEOUT_MS: how long our server may take while the public service stands behind
//   it (4000). With the public service off it gets the caller's own limit.
// A failure (no answer, a redirect, 401, 403, 5xx) sends the same request to the public service while
// that is allowed. After SELF_FAILS failures in a row our server is left out for a minute, so an
// outage does not add its time limit to every request. 400, 404 and 429 are answers, not an outage:
// they do not count towards the pause (a 404 is a path our server does not serve).
// Counted as self:<kind> with requests only (weight 0): weighted calls are the public service's bill.
const ON_SELF = new Set(['api.open-meteo.com', 'air-quality-api.open-meteo.com'])
const SELF_FAILS = 3
const SELF_PAUSE_MS = 60_000
let selfFails = 0, selfPausedUntil = 0
export const resetSelf = () => { selfFails = 0; selfPausedUntil = 0 }
const selfPaused = (now = Date.now()) => now < selfPausedUntil
const publicOff = (env = process.env) => env.OPEN_METEO_PUBLIC === 'off'

// where our server answers this request, or null: unset, an address that is not https (the token must
// not travel in the clear; localhost is allowed for a rehearsal), or a host our server does not replace
export function selfUrl(url, env = process.env) {
  if (!env.OPEN_METEO_SELF) return null
  try {
    const u = new URL(url), base = new URL(env.OPEN_METEO_SELF)
    if (!ON_SELF.has(u.hostname)) return null
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) return null
    return `${base.origin}${u.pathname}${u.search}`
  } catch {
    return null
  }
}

function noteSelf(ok, now = Date.now()) {
  if (ok) { selfFails = 0; return }
  if (++selfFails >= SELF_FAILS) { selfFails = 0; selfPausedUntil = now + SELF_PAUSE_MS }
}

// a request that is not sent: noted like a failed one, so the thin-blend log says why
function refuse(url, name) {
  noteFailure(url, 0, name)
  return Promise.reject(Object.assign(new Error(`Open-Meteo request not sent: ${name}`), { name }))
}

const selfToken = (env = process.env) => (env.OPEN_METEO_SELF_ID && env.OPEN_METEO_SELF_SECRET
  ? { 'CF-Access-Client-Id': env.OPEN_METEO_SELF_ID, 'CF-Access-Client-Secret': env.OPEN_METEO_SELF_SECRET }
  : {})

async function viaSelf(url, self, kind, init, env = process.env) {
  const alone = publicOff(env)
  const limit = Number(env.OPEN_METEO_SELF_TIMEOUT_MS) || 4000
  const token = selfToken(env)
  void countRequest(url, { kind: `self:${kind ?? 'other'}`, calls: 0 })
  let res, failed
  try {
    res = await gatedFetch(self, {
      ...init, headers: { ...Object.fromEntries(new Headers(init.headers ?? {})), ...token }, redirect: 'error',
      timeoutMs: alone ? init.timeoutMs ?? limit : Math.min(init.timeoutMs ?? limit, limit),
    })
  } catch (e) {
    failed = e
  }
  const down = failed || res.status >= 500 || res.status === 401 || res.status === 403
  if (down || res.ok) noteSelf(!down)
  if (res?.ok) return res
  if (alone) { if (failed) throw failed; return res }
  void countRequest(url, { kind })
  return gatedFetch(url, init)
}

// ── the comparison run (shadow mode) ─────────────────────────────────────────────────────────
// OPEN_METEO_SHADOW (a share: 0.2 is one request in five) together with OPEN_METEO_SELF: the public
// service answers every request as before, and that share is asked from our server as well, once the
// public answer is in hand and never in a visitor's way (outside the gate, at most MIRROR_MAX at a
// time, the rest skipped). Nothing a visitor sees comes from our server in this mode.
// Each pair is compared and counted (open_meteo_calls, requests only):
//   mirror:same, mirror:differ (a value further apart than rounding explains), mirror:missing (a value
//   the public service gave and ours did not), mirror:failed (no usable answer from ours)
//   and how long ours took to answer: mirror:1s, mirror:2s, mirror:4s, mirror:slow
// The first MIRROR_NOTES pairs of a UTC day that are not "same" go to the error log (open-meteo.mirror,
// a note: lib/health.js) with what differed; the place is kept to one decimal, as everywhere in that log.
// Ignored while the public service is off: there is nothing to compare with.
const MIRROR_MAX = 2
const MIRROR_NOTES = 20
const MIRROR_LIMIT_MS = 10_000
let mirroring = 0
let mirrorNotes = { day: '', n: 0 }
export const resetMirror = () => { mirroring = 0; mirrorNotes = { day: '', n: 0 } }

export const shadowShare = (env = process.env) => {
  const share = Number(env.OPEN_METEO_SHADOW)
  return share > 0 && share <= 1 && !publicOff(env) ? share : 0
}

// two values are apart when rounding cannot explain it: more than 0.11, or more than 1 % for large ones
const apart = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > Math.max(0.11, Math.abs(a) * 0.01) : a !== b)
const BLOCKS = ['current', 'minutely_15', 'hourly', 'daily']

// What our server's answer lacks or says differently, against the public one (pure). An elevation
// answer is one list; a forecast answer has blocks of lists (single values in "current").
export function compareAnswers(pub, own) {
  const out = { result: 'same', values: 0, missing: 0, differ: 0, maxDiff: 0, worst: null, missingKeys: [] }
  if (!own || typeof own !== 'object') return { ...out, result: 'failed' }
  const pairs = []
  if (Array.isArray(pub?.elevation)) pairs.push(['elevation', pub.elevation, own.elevation])
  for (const block of BLOCKS) {
    const a = pub?.[block], b = own[block]
    if (!a) continue
    // not the same hours: comparing value by value would say nothing
    const t0 = x => (Array.isArray(x?.time) ? x.time[0] : x?.time)
    if (b && t0(a) !== t0(b)) { out.differ++; out.worst ??= `${block}.time`; continue }
    for (const [k, v] of Object.entries(a)) if (k !== 'time' && k !== 'interval') pairs.push([`${block}.${k}`, v, b?.[k]])
  }
  for (const [key, a, b] of pairs) {
    const as = Array.isArray(a) ? a : [a], bs = Array.isArray(b) ? b : [b]
    let lacking = 0
    as.forEach((x, i) => {
      if (x == null) return
      out.values++
      const y = bs[i]
      if (y == null) { lacking++; return }
      if (!apart(x, y)) return
      out.differ++
      const d = typeof x === 'number' && typeof y === 'number' ? Math.round(Math.abs(x - y) * 100) / 100 : 0
      if (d > out.maxDiff || out.worst == null) { out.maxDiff = Math.max(d, out.maxDiff); out.worst = key }
    })
    if (lacking) { out.missing += lacking; out.missingKeys.push(key) }
  }
  out.result = out.missing ? 'missing' : out.differ ? 'differ' : 'same'
  return out
}

// keeps the function alive until the comparison is done (Next's after()); outside a request, as in a
// test, there is nothing to keep alive and the comparison simply runs
function keepAlive(promise) {
  import('next/server').then(m => m.after(() => promise)).catch(() => {})
}

async function mirror(url, self, kind, publicAnswer, env = process.env) {
  if (mirroring >= MIRROR_MAX) return
  mirroring++
  const started = Date.now()
  let own = null, status = 0
  try {
    const res = await fetch(self, { headers: selfToken(env), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(MIRROR_LIMIT_MS) })
    status = res.status
    if (res.ok) own = await res.json()
  } catch (e) {
    status = e?.name ?? 'Error'
  } finally {
    mirroring--
  }
  const ms = Date.now() - started
  try {
    const found = compareAnswers(await publicAnswer.json(), own)
    void countRequest(url, { kind: `mirror:${found.result}`, calls: 0 })
    if (own) void countRequest(url, { kind: `mirror:${ms < 1000 ? '1s' : ms < 2000 ? '2s' : ms < 4000 ? '4s' : 'slow'}`, calls: 0 })
    if (found.result === 'same') return
    const day = new Date().toISOString().slice(0, 10)
    if (mirrorNotes.day !== day) mirrorNotes = { day, n: 0 }
    if (mirrorNotes.n++ >= MIRROR_NOTES) return
    const p = new URL(url).searchParams
    const coarse = k => (p.get(k) ?? '').split(',').map(v => (Number.isFinite(Number(v)) && v !== '' ? Number(v).toFixed(1) : '')).join(',')
    const what = found.result === 'failed' ? `no usable answer (${status})`
      : found.result === 'missing' ? `${found.missing} of ${found.values} values missing, first in ${found.missingKeys[0]}`
      : `${found.differ} of ${found.values} values differ, most in ${found.worst} (by ${found.maxDiff})`
    await logError('open-meteo.mirror', new Error(`our server, ${kind ?? 'other'}: ${what}`), {
      kind: kind ?? 'other', result: found.result, status, ms, path: new URL(url).pathname, place: `${coarse('latitude')};${coarse('longitude')}`,
      models: p.get('models'), values: found.values, missing: found.missing, differ: found.differ, maxDiff: found.maxDiff, worst: found.worst,
      missingKeys: found.missingKeys.slice(0, 8),
    })
  } catch (e) {
    console.error('[open-meteo mirror]', e?.message ?? e)
  }
}

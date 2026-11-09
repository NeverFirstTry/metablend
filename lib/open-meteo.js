// Every request to Open-Meteo goes through here (lib/weather.js tfetch, lib/outlook/http.js getJson, the
// two direct calls). It notices the one answer that changes how we cache: a 429 whose reason says the
// daily limit is used up. That limit resets at midnight UTC and is per IP, so until then no Open-Meteo
// source comes back and a blend missing them is kept its full 15 minutes (lib/forecast-cache.js) instead
// of being refetched every 2 minutes against a wall.
import { supabase } from './supabase.js'
import { logError, isMissingDbObject, logMissingOnce } from './log.js'

export const isOpenMeteo = url => { try { return new URL(url).hostname.endsWith('open-meteo.com') } catch { return false } }

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
  return Math.round(locations * Math.max(1, variables * models / 10) * Math.max(1, days / 14) * 100) / 100
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

// one bump per request in its UTC hour (open_meteo_calls, supabase/open-meteo-calls.sql), fire and
// forget: never awaited on the request's path (openMeteoFetch), given up after COUNT_TIMEOUT_MS, and a
// missing table or function (its SQL not run yet) logged once per instance, not per call
export const COUNT_TIMEOUT_MS = 1500
export function countRequest(url, { db = supabase, now = Date.now(), log = logError } = {}) {
  const d = new Date(now)
  return Promise.resolve()
    .then(() => {
      const bump = db.rpc('bump_open_meteo_calls', { p_day: d.toISOString().slice(0, 10), p_hour: d.getUTCHours(), p_calls: callWeight(url) })
      return bump.abortSignal?.(AbortSignal.timeout(COUNT_TIMEOUT_MS)) ?? bump
    })
    .then(({ data, error }) => {
      if (error) { if (isMissingDbObject(error)) return logMissingOnce('open-meteo.count', error, log); console.error('[open-meteo count]', error.message); return }
      const msg = quotaAlert(Number(data), now)
      if (msg) return log('open-meteo.quota', new Error(msg), { day: d.toISOString().slice(0, 10), calls: Number(data) })
    })
    .catch(e => console.error('[open-meteo count]', e?.message ?? e))
}

// fetch with the request counted and the answer noted; the body of a 429 is read from a clone so the
// caller still gets it
export async function openMeteoFetch(url, init) {
  void countRequest(url)
  const res = await fetch(url, init)
  if (res.status === 429) noteAnswer(url, 429, await res.clone().text().catch(() => ''))
  return res
}

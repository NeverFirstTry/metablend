// Every request to Open-Meteo goes through here (lib/weather.js tfetch, lib/outlook/http.js getJson, the
// two direct calls). It notices the one answer that changes how we cache: a 429 whose reason says the
// daily limit is used up. That limit resets at midnight UTC and is per IP, so until then no Open-Meteo
// source comes back and a blend missing them is kept its full 15 minutes (lib/forecast-cache.js) instead
// of being refetched every 2 minutes against a wall.
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

// fetch with the answer noted; the body of a 429 is read from a clone so the caller still gets it
export async function openMeteoFetch(url, init) {
  const res = await fetch(url, init)
  if (res.status === 429) noteAnswer(url, 429, await res.clone().text().catch(() => ''))
  return res
}

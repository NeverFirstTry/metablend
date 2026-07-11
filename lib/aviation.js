// MetaBlend Aviation: METAR/TAF access (NOAA Aviation Weather Center — free,
// no key) plus the classic pilot calculations. Airport + runway data comes
// from OurAirports (public domain), trimmed to ICAO-coded fields at build
// time (lib/airports.json).
//
// Supplementary situational awareness ONLY — never a substitute for an
// official preflight briefing. Every aviation page repeats this.

import airports from './airports.json'

const AWC = 'https://aviationweather.gov/api/data'
const HEADERS = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

export function getAirport(icao) {
  const a = airports[icao?.toUpperCase()]
  if (!a) return null
  return {
    icao: icao.toUpperCase(),
    name: a.n,
    lat: a.la,
    lon: a.lo,
    elevFt: a.e,
    country: a.c,
    municipality: a.m,
    size: a.t, // l / m / s
    runways: a.r.map(r => ({
      leIdent: r.le, heIdent: r.he, leHdg: r.lh, heHdg: r.hh,
      lengthFt: r.len, surface: r.sfc,
    })),
  }
}

export const AIRPORT_COUNT = Object.keys(airports).length

export async function fetchMetar(icao) {
  try {
    const res = await fetch(`${AWC}/metar?ids=${icao}&format=json`, {
      headers: HEADERS, next: { revalidate: 600 },
    })
    if (!res.ok) return null
    const arr = await res.json()
    return Array.isArray(arr) && arr.length ? arr[0] : null
  } catch {
    return null
  }
}

export async function fetchTaf(icao) {
  try {
    const res = await fetch(`${AWC}/taf?ids=${icao}&format=json`, {
      headers: HEADERS, next: { revalidate: 1800 },
    })
    if (!res.ok) return null
    const arr = await res.json()
    return Array.isArray(arr) && arr.length ? arr[0] : null
  } catch {
    return null
  }
}

// "10+" → 10, "1 1/2" → 1.5, plain numbers pass through
export function parseVisibility(v) {
  if (v == null) return null
  if (typeof v === 'number') return v
  const s = String(v).replace('+', '').trim()
  const frac = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s)
  if (frac) return +frac[1] + +frac[2] / +frac[3]
  const f2 = /^(\d+)\/(\d+)$/.exec(s)
  if (f2) return +f2[1] / +f2[2]
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

// Lowest broken/overcast layer = ceiling
export function ceilingFt(clouds) {
  if (!Array.isArray(clouds)) return null
  const bases = clouds
    .filter(c => ['BKN', 'OVC', 'OVX', 'VV'].includes(c.cover))
    .map(c => c.base)
    .filter(b => typeof b === 'number')
  return bases.length ? Math.min(...bases) : null
}

// US flight-category convention (visibility in SM, ceiling in ft AGL)
export function flightRules(visSM, ceilFt) {
  const v = visSM ?? 99
  const c = ceilFt ?? 99999
  if (v < 1 || c < 500) return 'LIFR'
  if (v < 3 || c < 1000) return 'IFR'
  if (v <= 5 || c <= 3000) return 'MVFR'
  return 'VFR'
}

export const RULES_COLOR = {
  VFR: 'var(--ok)', MVFR: 'var(--info)', IFR: 'var(--bad)', LIFR: '#c084fc',
}

// Approximate pressure + density altitude (ft). altim comes from AWC in hPa.
export function densityAltitude(elevFt, tempC, altimHpa) {
  if (elevFt == null || tempC == null || altimHpa == null) return null
  const pa = elevFt + (1013.25 - altimHpa) * 30
  const isa = 15 - 2 * (pa / 1000)
  return { pressureAltFt: Math.round(pa), densityAltFt: Math.round(pa + 120 * (tempC - isa)) }
}

// Wind components for one runway heading. Positive cross = from the right.
export function windComponents(wdir, wspdKt, runwayHdg) {
  if (typeof wdir !== 'number' || typeof wspdKt !== 'number' || runwayHdg == null) return null
  const angle = ((wdir - runwayHdg + 540) % 360) - 180
  const rad = (angle * Math.PI) / 180
  return {
    angle,
    headKt: Math.round(wspdKt * Math.cos(rad)),   // negative = tailwind
    crossKt: Math.round(wspdKt * Math.sin(rad)),  // negative = from the left
  }
}

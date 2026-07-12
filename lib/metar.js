// Pure METAR/TAF token helpers. Kept free of airport-data imports (unlike
// aviation.js) so `node --test` can exercise them without bundler help.
//
// Scope note: these helpers only FLAG a fixed catalog of significant-weather
// codes and only EXTRACT RVR groups that match the spec exactly. Anything
// unrecognized is left alone — the pages always show the raw METAR/TAF text,
// so unknown tokens degrade to "visible but undecoded", never to a guess.

// Significant weather worth shouting about, per dispatcher guidance:
// thunderstorms and freezing precipitation drive dispatch decisions; hail,
// squalls, funnel clouds and dust/sand storms round out the severe set.
// Plain rain/snow/fog stay unflagged — visibility and ceiling already carry
// that signal.
const CATALOG = [
  // [detect, label, severity] — detect runs against one wx token at a time
  [t => t.includes('TS'), 'Thunderstorm', 'severe'],
  [t => t.includes('FC'), 'Funnel cloud', 'severe'], // '+FC' upgraded below
  [t => t.includes('GR'), 'Hail', 'severe'],
  [t => t.includes('FZRA'), 'Freezing rain', 'severe'],
  [t => t.includes('FZDZ'), 'Freezing drizzle', 'severe'],
  [t => t === 'SQ' || t === '+SQ', 'Squall', 'severe'],
  [t => t.includes('VA'), 'Volcanic ash', 'severe'],
  [t => t.endsWith('SS'), 'Sandstorm', 'severe'],
  [t => t.endsWith('DS'), 'Duststorm', 'severe'],
  [t => t.includes('GS'), 'Small hail / snow pellets', 'caution'],
  [t => t.includes('PL'), 'Ice pellets', 'caution'],
  [t => t.includes('FZFG'), 'Freezing fog', 'caution'],
  [t => t.includes('BLSN'), 'Blowing snow', 'caution'],
]

// wxString ("-TSRA BR", "VCTS", "+FZRA") -> deduped flags, severe first.
// Returns [] for null/undefined/benign weather.
export function sigWeather(wxString) {
  if (!wxString || typeof wxString !== 'string') return []
  const found = new Map()
  for (const raw of wxString.trim().split(/\s+/)) {
    const heavy = raw.startsWith('+')
    const vicinity = raw.startsWith('VC')
    const token = raw.replace(/^[+-]/, '')
    for (const [detect, baseLabel, severity] of CATALOG) {
      if (!detect(token)) continue
      let label = baseLabel
      if (label === 'Funnel cloud' && heavy) label = 'Tornado / waterspout'
      else if (heavy) label = `Heavy ${baseLabel.toLowerCase()}`
      if (vicinity) label += ' (vicinity)'
      const key = `${label}|${severity}`
      if (!found.has(key)) found.set(key, { label, severity, vicinity })
    }
  }
  return [...found.values()].sort((a, b) => (a.severity === 'severe' ? 0 : 1) - (b.severity === 'severe' ? 0 : 1))
}

// RVR groups from a raw METAR (never from a TAF — RVR is measured, not
// forecast). "R24L/P2000N" -> { rwy: '24L', text: '>2000 m' }.
// Non-matching text is simply not reported.
export function parseRvr(rawOb) {
  if (!rawOb || typeof rawOb !== 'string') return []
  const out = []
  const re = /\bR(\d{2}[LRC]?)\/([PM]?)(\d{4})(?:V([PM]?)(\d{4}))?(FT)?\/?([UDN])?(?=\s|$)/g
  for (const m of rawOb.matchAll(re)) {
    const [, rwy, q1, v1, q2, v2, ft, trend] = m
    const unit = ft ? 'ft' : 'm'
    const fmt = (q, v) => `${q === 'P' ? '>' : q === 'M' ? '<' : ''}${+v}`
    let text = `${fmt(q1, v1)}${v2 ? `–${fmt(q2 ?? '', v2)}` : ''} ${unit}`
    if (trend === 'U') text += ' improving'
    if (trend === 'D') text += ' worsening'
    out.push({ rwy, text })
  }
  return out
}

// Per-value flight-category classification (same NWS thresholds that
// aviation.js flightRules() combines): lets the page color ceiling and
// visibility independently. null in -> null out (unknown, not "VFR").
export function visCategory(visSM) {
  if (visSM == null) return null
  if (visSM < 1) return 'LIFR'
  if (visSM < 3) return 'IFR'
  if (visSM <= 5) return 'MVFR'
  return 'VFR'
}

export function ceilingCategory(ceilFt) {
  if (ceilFt == null) return null
  if (ceilFt < 500) return 'LIFR'
  if (ceilFt < 1000) return 'IFR'
  if (ceilFt <= 3000) return 'MVFR'
  return 'VFR'
}

// TAF windshear group (AWC exposes it as wshearHgt/wshearDir/wshearSpd on a
// forecast period; field name has varied, so check both spellings).
export function tafWindshear(fcst) {
  if (!fcst) return null
  const hgt = fcst.wshearHgt ?? fcst.wsHgt
  if (hgt == null) return null
  const dir = fcst.wshearDir ?? fcst.wsDir
  const spd = fcst.wshearSpd ?? fcst.wsSpd
  return { label: `Windshear ${hgt} ft${dir != null && spd != null ? ` · ${String(dir).padStart(3, '0')}°/${spd} kt` : ''}`, severity: 'severe' }
}

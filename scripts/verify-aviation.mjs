// Aviation math verification: MetaBlend lib vs independent references.
//
// Layer A — formula audit on live AWC data for 6 airports:
//   flight rules  -> compared against AWC's own fltCat field
//   pressure alt  -> compared against FAA formula PA = elev + (29.92 - inHg) * 1000
//   density alt   -> compared against exact dry-air ISA formula (145442.16 * (1 - sigma^0.235))
//   crosswind     -> compared against independent vector-math implementation
//
// Layer B — live page checks (disclaimer + badge consistency) done separately.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

// usage: node scripts/verify-aviation.mjs   (from the repo root or anywhere)
const LIB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib')

// aviation.js imports airports.json without an import attribute (fine under
// Next/Turbopack, rejected by plain Node) — patch a copy so we test the REAL
// exported functions, not re-typed ones.
const src = fs.readFileSync(path.join(LIB_DIR, 'aviation.js'), 'utf8')
const airportsPath = pathToFileURL(path.join(LIB_DIR, 'airports.json')).href
const patched = src.replace(
  "import airports from './airports.json'",
  `import fs from 'node:fs';\nconst airports = JSON.parse(fs.readFileSync(new URL('${airportsPath}'), 'utf8'))`
)
const testModPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-verify-')), 'aviation-under-test.mjs')
fs.writeFileSync(testModPath, patched)
const lib = await import(pathToFileURL(testModPath).href)

// ---------- independent reference implementations ----------

// FAA pressure altitude, inches of mercury based
function refPressureAlt(elevFt, altimHpa) {
  const inHg = altimHpa / 33.8639
  return elevFt + (29.92 - inHg) * 1000
}

// Exact dry-air density altitude from PA + OAT (ISA power-law form)
function refDensityAltExact(paFt, tempC) {
  const delta = Math.pow(1 - 6.8756e-6 * paFt, 5.2559) // pressure ratio at PA
  const theta = (tempC + 273.15) / 288.15              // temperature ratio
  const sigma = delta / theta                          // density ratio
  return 145442.16 * (1 - Math.pow(sigma, 0.234969))
}

// FAA rule-of-thumb DA (the formula class our lib approximates)
function refDensityAltFaa(paFt, tempC) {
  const isa = 15 - 1.98 * (paFt / 1000)
  return paFt + 118.8 * (tempC - isa)
}

// Independent wind components via 2D vectors (no shared code with the lib).
// Wind FROM wdir means the air moves TOWARD wdir+180.
function refWind(wdir, wspd, rwyHdg) {
  const rad = d => (d * Math.PI) / 180
  // unit vector of runway direction (compass: x=east, y=north)
  const rx = Math.sin(rad(rwyHdg)), ry = Math.cos(rad(rwyHdg))
  // air velocity vector (moving toward wdir+180)
  const vx = wspd * Math.sin(rad(wdir + 180)), vy = wspd * Math.cos(rad(wdir + 180))
  // headwind = component of air velocity AGAINST runway direction
  const head = -(vx * rx + vy * ry)
  // cross from the right = component along runway-right normal, sign flipped
  // (air coming FROM the right moves left, i.e. against the right normal)
  const nx = Math.cos(rad(rwyHdg)), ny = -Math.sin(rad(rwyHdg)) // right-hand normal
  const cross = -(vx * nx + vy * ny)
  return { head, cross }
}

// US flight category per NWS/AWC definitions (independent re-statement):
// LIFR: cig < 500 OR vis < 1; IFR: cig 500-999 OR vis 1-2; MVFR: cig 1000-3000
// OR vis 3-5; VFR: cig > 3000 AND vis > 5
function refFlightCat(visSM, ceilFt) {
  const v = visSM ?? 999, c = ceilFt ?? 999999
  if (c < 500 || v < 1) return 'LIFR'
  if (c < 1000 || v < 3) return 'IFR'
  if (c <= 3000 || v <= 5) return 'MVFR'
  return 'VFR'
}

// ---------- run ----------

const IDS = ['LOWI', 'LOWW', 'EDDM', 'EGLL', 'KJFK', 'KLAX']
const res = await fetch(`https://aviationweather.gov/api/data/metar?ids=${IDS.join(',')}&format=json`, {
  headers: { 'User-Agent': 'MetaBlend-verify/1.0 github.com/NeverFirstTry/metablend' },
})
const metars = await res.json()

const issues = []
const report = []

for (const id of IDS) {
  const m = metars.find(x => x.icaoId === id)
  const ap = lib.getAirport(id)
  if (!m) { issues.push(`${id}: no METAR returned by AWC`); continue }
  if (!ap) { issues.push(`${id}: not in airports.json`); continue }

  const lines = [`\n=== ${id} (${ap.name}) — elev ${ap.elevFt} ft ===`, `RAW: ${m.rawOb}`]

  // --- flight rules ---
  const visSM = lib.parseVisibility(m.visib)
  const ceil = lib.ceilingFt(m.clouds)
  const ours = lib.flightRules(visSM, ceil)
  const awc = m.fltCat ?? m.fltcat ?? '(absent)'
  const ref = refFlightCat(visSM, ceil)
  lines.push(`Flight rules: ours=${ours}  awc=${awc}  ref=${ref}   (vis=${JSON.stringify(m.visib)} -> ${visSM} SM, ceiling=${ceil ?? 'none'} ft)`)
  if (awc !== '(absent)' && ours !== awc) issues.push(`${id}: flight rules ${ours} != AWC ${awc} (vis ${m.visib}, ceil ${ceil})`)
  if (ours !== ref) issues.push(`${id}: flight rules ${ours} != independent ref ${ref}`)

  // --- pressure / density altitude ---
  const da = lib.densityAltitude(ap.elevFt, m.temp, m.altim)
  if (da) {
    const paRef = refPressureAlt(ap.elevFt, m.altim)
    const daExact = refDensityAltExact(paRef, m.temp)
    const daFaa = refDensityAltFaa(paRef, m.temp)
    const paDiff = da.pressureAltFt - paRef
    const daDiffExact = da.densityAltFt - daExact
    lines.push(`PA: ours=${da.pressureAltFt}  faaRef=${Math.round(paRef)}  diff=${Math.round(paDiff)} ft   (QNH ${m.altim.toFixed(1)} hPa, T ${m.temp}°C)`)
    lines.push(`DA: ours=${da.densityAltFt}  exactISA=${Math.round(daExact)}  faaRule=${Math.round(daFaa)}  diff-vs-exact=${Math.round(daDiffExact)} ft`)
    if (Math.abs(paDiff) > 50) issues.push(`${id}: pressure altitude off by ${Math.round(paDiff)} ft vs FAA formula`)
    if (Math.abs(daDiffExact) > 250) issues.push(`${id}: density altitude off by ${Math.round(daDiffExact)} ft vs exact ISA formula`)
  } else {
    lines.push(`PA/DA: not computable (temp=${m.temp}, altim=${m.altim})`)
  }

  // --- crosswind per runway end ---
  if (typeof m.wdir === 'number' && typeof m.wspd === 'number') {
    for (const r of ap.runways) {
      for (const end of [{ id: r.leIdent, h: r.leHdg }, { id: r.heIdent, h: r.heHdg }]) {
        if (end.h == null) { lines.push(`RWY ${end.id}: no heading in data`); continue }
        const w = lib.windComponents(m.wdir, m.wspd, end.h)
        const rw = refWind(m.wdir, m.wspd, end.h)
        const hd = w.headKt - rw.head, cd = w.crossKt - rw.cross
        lines.push(`RWY ${end.id} (${end.h}°): ours head=${w.headKt} cross=${w.crossKt}  ref head=${rw.head.toFixed(1)} cross=${rw.cross.toFixed(1)}`)
        if (Math.abs(hd) > 0.51 || Math.abs(cd) > 0.51)
          issues.push(`${id} RWY ${end.id}: wind components ours (${w.headKt}/${w.crossKt}) != ref (${rw.head.toFixed(1)}/${rw.cross.toFixed(1)})`)
      }
    }
  } else {
    lines.push(`Wind: not numeric (wdir=${JSON.stringify(m.wdir)}, wspd=${JSON.stringify(m.wspd)}) — page skips crosswind table`)
  }

  report.push(lines.join('\n'))
}

// --- sign-convention sanity cases (known-answer tests) ---
const cases = [
  { wdir: 90, wspd: 10, hdg: 360, expHead: 0, expCross: 10, note: 'RWY36, wind 090/10 -> 10 kt from RIGHT' },
  { wdir: 270, wspd: 10, hdg: 360, expHead: 0, expCross: -10, note: 'RWY36, wind 270/10 -> 10 kt from LEFT' },
  { wdir: 360, wspd: 10, hdg: 360, expHead: 10, expCross: 0, note: 'RWY36, wind 360/10 -> pure headwind' },
  { wdir: 180, wspd: 10, hdg: 360, expHead: -10, expCross: 0, note: 'RWY36, wind 180/10 -> pure tailwind' },
  { wdir: 40, wspd: 10, hdg: 360, expHead: 7.7, expCross: 6.4, note: 'E6B: 40° off, 10 kt' },
]
report.push('\n=== Known-answer crosswind cases ===')
for (const c of cases) {
  const w = lib.windComponents(c.wdir, c.wspd, c.hdg)
  const okH = Math.abs(w.headKt - c.expHead) <= 0.5, okC = Math.abs(w.crossKt - c.expCross) <= 0.5
  report.push(`${okH && okC ? 'PASS' : 'FAIL'} ${c.note}: got head=${w.headKt} cross=${w.crossKt}`)
  if (!okH || !okC) issues.push(`known-answer case failed: ${c.note} -> head=${w.headKt} cross=${w.crossKt}`)
}

// --- flight-rules boundary cases vs the NWS category table ---
report.push('\n=== Flight-rules boundary cases ===')
const frCases = [
  [0.9, null, 'LIFR'], [1, null, 'IFR'], [2.9, null, 'IFR'], [3, null, 'MVFR'],
  [5, null, 'MVFR'], [5.1, null, 'VFR'],
  [10, 499, 'LIFR'], [10, 500, 'IFR'], [10, 999, 'IFR'], [10, 1000, 'MVFR'],
  [10, 3000, 'MVFR'], [10, 3001, 'VFR'],
]
for (const [v, c, exp] of frCases) {
  const got = lib.flightRules(v, c)
  report.push(`${got === exp ? 'PASS' : 'FAIL'} vis=${v} ceil=${c ?? '—'} -> ${got} (expect ${exp})`)
  if (got !== exp) issues.push(`flightRules(${v}, ${c}) = ${got}, expected ${exp} per NWS table`)
}

console.log(report.join('\n'))
console.log('\n\n================ ISSUES ================')
console.log(issues.length ? issues.map(i => '- ' + i).join('\n') : 'NONE — all checks passed')

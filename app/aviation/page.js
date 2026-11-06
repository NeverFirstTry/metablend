import AviationHub from './AviationHub'
import { AIRPORT_COUNT, flightRules, parseVisibility } from '@/lib/aviation'
import { skyInfo } from '@/lib/metar'

export const revalidate = 600

export const metadata = {
  title: 'Aviation Weather — METAR, TAF, Crosswind & Density Altitude',
  description:
    'Decoded METAR and TAF, flight rules, runway crosswind components and density ' +
    'altitude for 12,000+ ICAO airports. Free, no key, no account.',
  alternates: { canonical: '/aviation' },
}

// The live category board: like the flight-category maps in every FBO, but as
// linkable chips. Grouped geographically; roughly the fields pilots actually
// look up plus the local Austrian ones.
const BOARD = [
  ['avEurope', ['LOWW', 'LOWI', 'LOWS', 'EDDM', 'EDDF', 'EGLL', 'LFPG', 'EHAM', 'LIRF', 'LSZH', 'LEMD', 'LIMC']],
  ['avAmericas', ['KJFK', 'KLAX', 'KORD', 'KMIA', 'KSFO', 'KATL', 'KDEN', 'CYYZ', 'SBGR', 'MMMX']],
  ['avAsia', ['RJTT', 'VHHH', 'WSSS', 'ZBAA', 'VIDP', 'OMDB', 'YSSY', 'NZAA']],
]

// One batch call for the whole board. Same category gate as the airport
// pages: unreported visibility or cloud heights yield no category, not VFR.
async function fetchCategories(ids) {
  try {
    const res = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${ids.join(',')}&format=json`,
      { headers: { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }, next: { revalidate: 600 } },
    )
    if (!res.ok) return {}
    const arr = await res.json()
    const out = {}
    for (const m of Array.isArray(arr) ? arr : []) {
      const vis = parseVisibility(m.visib)
      const sky = skyInfo(m.clouds)
      out[m.icaoId] = vis != null && sky.known && !sky.unknownBase ? flightRules(vis, sky.ceilingFt) : null
    }
    return out
  } catch {
    return {}
  }
}

export default async function AviationPage() {
  const cats = await fetchCategories(BOARD.flatMap(([, ids]) => ids))
  return <AviationHub board={BOARD} cats={cats} airports={AIRPORT_COUNT} />
}

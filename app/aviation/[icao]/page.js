import { notFound } from 'next/navigation'
import AirportPage from './AirportPage'
import {
  getAirport, fetchMetar, fetchTaf, parseVisibility,
  flightRules, densityAltitude, windComponents,
} from '@/lib/aviation'
import { sigWeather, parseRvr, visCategory, ceilingCategory, tafWindshear, skyInfo, reportFlags, activeTafPeriod, tafDivergence } from '@/lib/metar'

export const revalidate = 600

// On-demand caching: no pages are built ahead; each is rendered on its first
// visit and then served from the cache for `revalidate` seconds. Without
// this a dynamic route renders on every request and revalidate is ignored.
export async function generateStaticParams() { return [] }

export async function generateMetadata({ params }) {
  const { icao } = await params
  const ap = getAirport(icao)
  const code = icao.toUpperCase()
  return {
    title: ap ? `${code} METAR, TAF & Crosswind — ${ap.name}` : `${code} — Airport not found`,
    description: ap
      ? `Live decoded METAR and TAF for ${ap.name} (${code}): flight rules, runway ` +
        `crosswind components and density altitude, from NOAA data.`
      : 'Unknown ICAO code.',
    alternates: { canonical: `/aviation/${icao.toLowerCase()}` },
  }
}

const utc = ts => (ts ? new Date(ts * 1000).toISOString().slice(5, 16).replace('T', ' ') + 'Z' : '–')

export default async function Airport({ params }) {
  const { icao } = await params
  const ap = getAirport(icao)
  if (!ap) notFound()

  const [metar, taf] = await Promise.all([fetchMetar(ap.icao), fetchTaf(ap.icao)])

  const visSM = metar ? parseVisibility(metar.visib) : null
  const sky = skyInfo(metar?.clouds)
  const ceil = sky.ceilingFt
  // Only claim a flight category when its inputs were actually reported.
  // Unreported visibility or a ceiling-forming layer without a height
  // (VV///, BKN///) must fail visibly, not silently read as VFR.
  const rulesKnown = !!metar && visSM != null && sky.known && !sky.unknownBase
  const rules = rulesKnown ? flightRules(visSM, ceil) : null
  const flags = metar ? reportFlags(metar.rawOb) : []
  const da = metar ? densityAltitude(ap.elevFt, metar.temp, metar.altim) : null
  const windOk = metar && typeof metar.wdir === 'number' && typeof metar.wspd === 'number'
  const windVariable = metar && !windOk && typeof metar.wspd === 'number' && metar.wspd > 0

  // Significant weather (thunderstorms, freezing precip, hail …) drives
  // dispatch decisions — surface it from both the current METAR and every
  // TAF period, above everything else.
  const metarSig = metar ? sigWeather(metar.wxString) : []
  const tafAlerts = (taf?.fcsts ?? []).flatMap(f => {
    const flags = [...sigWeather(f.wxString)]
    const ws = tafWindshear(f)
    if (ws) flags.push(ws)
    return flags.map(fl => ({ ...fl, from: utc(f.timeFrom), to: utc(f.timeTo) }))
  })
  const alerts = [
    ...metarSig,
    ...tafAlerts,
  ]
  const hasSevere = alerts.some(a => a.severity === 'severe')
  const rvr = metar ? parseRvr(metar.rawOb) : [] // measured only — never forecast

  // Live TAF-vs-METAR divergence for the period valid right now. Weather
  // compares against base+TEMPO (TEMPO exists to carry showers/TS), while
  // vis/ceiling use the base line only so TEMPO fluctuations don't spam it.
  // Only runs when the METAR's own inputs were fully reported.
  // Anchored to the METAR's own observation time, not the clock: the question
  // is "which TAF period covers the observation we're comparing against". That
  // also keeps this render pure — on an ISR page Date.now() is the
  // regeneration time, which drifts away from the data it's judging.
  const obsSec = metar?.obsTime ?? (metar?.reportTime ? Date.parse(metar.reportTime) / 1000 : null)
  const { base: tafNow, tempo: tafTempo } = activeTafPeriod(taf?.fcsts, obsSec)
  const noVic = l => l.replace(' (vicinity)', '')
  let divergence = []
  if (rulesKnown && tafNow) {
    const tafSky = skyInfo(tafNow.clouds)
    const tafVis = parseVisibility(tafNow.visib)
    divergence = tafDivergence(
      {
        visCat: visCategory(visSM),
        ceilCat: ceilingCategory(ceil) ?? 'VFR',
        sig: metarSig.map(s => noVic(s.label)),
      },
      {
        visCat: tafVis != null ? visCategory(tafVis) : null,
        ceilCat: tafSky.known && !tafSky.unknownBase ? (ceilingCategory(tafSky.ceilingFt) ?? 'VFR') : null,
        sig: [...sigWeather(tafNow.wxString), ...sigWeather(tafTempo?.wxString)].map(s => noVic(s.label)),
      },
    )
  }

  // every runway end, best headwind first
  const ends = windOk
    ? ap.runways
        .flatMap(r => [
          { ident: r.leIdent, hdg: r.leHdg, len: r.lengthFt, sfc: r.surface },
          { ident: r.heIdent, hdg: r.heHdg, len: r.lengthFt, sfc: r.surface },
        ])
        .map(e => ({ ...e, w: windComponents(metar.wdir, metar.wspd, e.hdg) }))
        .sort((a, b) => (b.w?.headKt ?? -99) - (a.w?.headKt ?? -99))
    : []

  // only what the page shows goes into its HTML; the numbers are worked out here, the words in the browser
  return (
    <AirportPage
      ap={{ icao: ap.icao, name: ap.name, municipality: ap.municipality, country: ap.country, elevFt: ap.elevFt }}
      metar={metar && {
        visib: metar.visib, wxString: metar.wxString, wdir: metar.wdir, wspd: metar.wspd, wgst: metar.wgst, temp: metar.temp, dewp: metar.dewp,
        altim: metar.altim, clouds: metar.clouds, rawOb: metar.rawOb, reportUtc: metar.reportTime ? utc(Date.parse(metar.reportTime) / 1000) : null,
      }}
      taf={taf?.rawTAF ? {
        rawTAF: taf.rawTAF,
        fcsts: (Array.isArray(taf.fcsts) ? taf.fcsts : []).map(f => ({ ...f, fromUtc: utc(f.timeFrom), toUtc: utc(f.timeTo) })),
      } : null}
      visSM={visSM} sky={sky} rules={rules} rulesKnown={rulesKnown} flags={flags} da={da} windOk={!!windOk} windVariable={!!windVariable}
      metarSigSeverities={metarSig.map(s => s.severity)} alerts={alerts} hasSevere={hasSevere} rvr={rvr} divergence={divergence} hasTempo={!!tafTempo} ends={ends}
    />
  )
}

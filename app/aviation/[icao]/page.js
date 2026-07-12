import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import Footer from '../../components/Footer'
import {
  getAirport, fetchMetar, fetchTaf, parseVisibility,
  flightRules, RULES_COLOR, densityAltitude, windComponents,
} from '@/lib/aviation'
import { sigWeather, parseRvr, visCategory, ceilingCategory, tafWindshear, skyInfo, reportFlags, activeTafPeriod, tafDivergence } from '@/lib/metar'

export const revalidate = 600

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

export default async function AirportPage({ params }) {
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
    return flags.map(fl => ({ ...fl, when: `forecast ${utc(f.timeFrom)} – ${utc(f.timeTo)} (TAF)` }))
  })
  const alerts = [
    ...metarSig.map(fl => ({ ...fl, when: 'reported now (METAR)' })),
    ...tafAlerts,
  ]
  const hasSevere = alerts.some(a => a.severity === 'severe')
  const rvr = metar ? parseRvr(metar.rawOb) : [] // measured only — never forecast

  // Live TAF-vs-METAR divergence for the period valid right now. Weather
  // compares against base+TEMPO (TEMPO exists to carry showers/TS), while
  // vis/ceiling use the base line only so TEMPO fluctuations don't spam it.
  // Only runs when the METAR's own inputs were fully reported.
  const { base: tafNow, tempo: tafTempo } = activeTafPeriod(taf?.fcsts, Date.now() / 1000)
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

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/aviation" className="text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft size={15} aria-hidden /> Back
          </Link>
          <nav className="text-zinc-500 text-xs flex gap-2">
            <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
            <span>/</span>
            <Link href="/aviation" className="hover:text-emerald-400">Aviation</Link>
            <span>/</span>
            <span className="text-zinc-400">{ap.icao}</span>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {ap.icao} <span className="text-emerald-400">{ap.name}</span>
          </h1>
          {rules && (
            <span
              className="text-xs font-bold tracking-widest border rounded px-2 py-1"
              style={{ color: RULES_COLOR[rules], borderColor: RULES_COLOR[rules] }}
            >
              {rules}
            </span>
          )}
          {metar && !rulesKnown && (
            <span className="text-xs font-bold tracking-widest border border-zinc-600 text-zinc-400 rounded px-2 py-1">
              CAT N/A
            </span>
          )}
          {flags.map(f => (
            <span key={f} className="text-[10px] tracking-widest border border-zinc-700 text-zinc-400 rounded px-1.5 py-0.5">
              {f}
            </span>
          ))}
        </div>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          {ap.municipality ? `${ap.municipality} · ` : ''}{ap.country}
          {ap.elevFt != null ? ` · elev ${ap.elevFt} ft` : ''}
        </p>

        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-red-200 text-xs mb-6 leading-relaxed">
          <strong>Not for flight planning.</strong> Supplementary information from public NOAA data —
          always obtain an official preflight briefing.
        </div>

        {alerts.length > 0 && (
          <div
            className={`border rounded-lg p-3 text-xs mb-6 leading-relaxed ${
              hasSevere
                ? 'bg-red-950/60 border-red-400/50 text-red-100'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
            }`}
            role="alert"
          >
            <strong className="tracking-widest uppercase">⚠ Significant weather</strong>
            <ul className="mt-1.5 space-y-0.5">
              {alerts.map((a, i) => (
                <li key={i}>
                  <span className={a.severity === 'severe' ? 'font-bold' : ''}>{a.label}</span>
                  <span className="opacity-75"> — {a.when}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* METAR */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
            METAR {metar?.reportTime ? `· ${utc(Date.parse(metar.reportTime) / 1000)}` : ''}
          </h2>
          {metar ? (
            <>
              {/* Ceiling + visibility lead: they decide dispatch legality and
                  alternates, so they get the big numbers (dispatcher input). */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Ceiling</div>
                  <div
                    className="text-2xl sm:text-3xl font-bold tabular-nums"
                    style={{
                      color: ceil != null ? RULES_COLOR[ceilingCategory(ceil)]
                        : sky.obscured ? RULES_COLOR.LIFR
                        : sky.unknownBase || !sky.known ? '#a1a1aa'
                        : RULES_COLOR.VFR,
                    }}
                  >
                    {ceil != null ? `${ceil.toLocaleString('en')} ft`
                      : sky.obscured ? 'Obscured'
                      : sky.unknownBase ? 'Not reported'
                      : sky.known ? 'No ceiling' : '–'}
                  </div>
                  <div className="text-zinc-500 text-xs mt-1">
                    {sky.obscured ? 'sky obscured, vertical visibility not reported'
                      : sky.unknownBase && ceil == null ? 'cloud layer height missing from report'
                      : !sky.known ? 'no sky data in report'
                      : 'lowest BKN/OVC layer AGL'}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Visibility</div>
                  <div
                    className="text-2xl sm:text-3xl font-bold tabular-nums"
                    style={{ color: visSM != null ? RULES_COLOR[visCategory(visSM)] : '#a1a1aa' }}
                  >
                    {metar.visib != null ? `${metar.visib} SM` : '–'}
                  </div>
                  {rvr.length > 0 && (
                    <div className="text-zinc-400 text-xs mt-1 tabular-nums">
                      RVR {rvr.map(r => `${r.rwy}: ${r.text}`).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
              {!rulesKnown && (
                <p className="text-amber-200/90 text-xs mb-5">
                  Flight category not determined — {[
                    visSM == null && 'visibility not reported',
                    !sky.known && 'no sky data in report',
                    sky.known && sky.unknownBase && 'cloud height not reported',
                  ].filter(Boolean).join(', ')}. The raw report below is authoritative.
                </p>
              )}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm mb-5">
                <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Weather</dt>
                  <dd className="font-bold" style={metarSig.length ? { color: metarSig.some(s => s.severity === 'severe') ? 'var(--bad)' : 'var(--warn)' } : undefined}>
                    {metar.wxString ?? '–'}
                  </dd></div>
                <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Wind</dt>
                  <dd className="font-bold tabular-nums">
                    {typeof metar.wdir === 'number' ? `${String(metar.wdir).padStart(3, '0')}°` : metar.wdir ?? '–'}
                    {typeof metar.wspd === 'number' ? ` / ${metar.wspd} kt` : ''}
                    {metar.wgst ? ` G${metar.wgst}` : ''}
                  </dd></div>
                <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Temp / Dew</dt>
                  <dd className="font-bold tabular-nums">{metar.temp ?? '–'}° / {metar.dewp ?? '–'}°C</dd></div>
                <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">QNH</dt>
                  <dd className="font-bold tabular-nums">{metar.altim ? `${Math.round(metar.altim)} hPa` : '–'}</dd></div>
              </dl>
              {Array.isArray(metar.clouds) && metar.clouds.length > 0 && (
                <p className="text-sm text-zinc-400 mb-4">
                  Clouds: {metar.clouds.map(c => `${c.cover}${c.base ? ` ${c.base} ft` : ''}`).join(', ')}
                </p>
              )}
              <code className="block text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg p-3 break-all">
                {metar.rawOb}
              </code>
            </>
          ) : (
            <p className="text-zinc-500 text-sm">No METAR available — this field may not report weather.</p>
          )}
        </section>

        {/* Live TAF-vs-METAR divergence: is the forecast holding up right now? */}
        {divergence.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">TAF vs METAR — right now</h2>
            <ul className="space-y-2 text-sm">
              {divergence.map((d, i) => (
                <li key={i} className="flex flex-wrap gap-x-2 items-baseline">
                  {d.field === 'weather' ? (
                    d.metar ? (
                      <>
                        <span className="font-bold" style={{ color: 'var(--bad)' }}>{d.metar}</span>
                        <span className="text-zinc-400">reported now, not in the TAF for this hour</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold" style={{ color: 'var(--warn)' }}>{d.taf}</span>
                        <span className="text-zinc-400">in the TAF for this hour, not currently observed</span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="text-zinc-400 capitalize">{d.field}:</span>
                      <span className="font-bold" style={{ color: RULES_COLOR[d.metar] }}>METAR {d.metar}</span>
                      <span className="text-zinc-500">vs</span>
                      <span className="font-bold" style={{ color: RULES_COLOR[d.taf] }}>TAF {d.taf}</span>
                      <span className="text-zinc-400">— conditions {d.tafOptimistic ? 'worse' : 'better'} than forecast</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-zinc-500 text-xs mt-3">
              Category-level comparison of the latest METAR against the TAF period valid now
              {tafTempo ? ' (TEMPO overlay included for weather)' : ''}.
            </p>
          </section>
        )}

        {/* Crosswind */}
        {ends.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6 overflow-x-auto">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">
              Runway wind components · wind {String(metar.wdir).padStart(3, '0')}° / {metar.wspd} kt
            </h2>
            <table className="w-full text-sm text-left min-w-[420px]">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4 font-normal">RWY</th>
                  <th className="py-2 pr-4 font-normal">Heading</th>
                  <th className="py-2 pr-4 font-normal">Head / Tail</th>
                  <th className="py-2 pr-4 font-normal">Crosswind</th>
                  <th className="py-2 font-normal">Length</th>
                </tr>
              </thead>
              <tbody>
                {ends.map((e, i) => (
                  <tr key={`${e.ident}-${i}`} className="border-t border-zinc-800">
                    <td className={`py-2 pr-4 font-bold ${i === 0 ? 'text-emerald-400' : ''}`}>
                      {e.ident}{i === 0 ? ' ★' : ''}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{String(e.hdg).padStart(3, '0')}°</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: e.w.headKt >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                      {e.w.headKt >= 0 ? `${e.w.headKt} kt head` : `${-e.w.headKt} kt tail`}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {Math.abs(e.w.crossKt)} kt {e.w.crossKt === 0 ? '' : e.w.crossKt > 0 ? 'from R' : 'from L'}
                    </td>
                    <td className="py-2 tabular-nums">{e.len ? `${e.len} ft` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-zinc-500 text-xs mt-3">★ best headwind. Components from current METAR wind; gusts not included.</p>
          </section>
        )}

        {windVariable && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-3">Runway wind components</h2>
            <p className="text-sm text-zinc-300">
              Wind direction is variable ({typeof metar.wdir === 'string' ? metar.wdir : 'VRB'}) at {metar.wspd} kt
              {metar.wgst ? `, gusting ${metar.wgst} kt` : ''} — per-runway components cannot be computed.
              With no fixed direction, any runway may see the full {metar.wgst ?? metar.wspd} kt as crosswind.
            </p>
          </section>
        )}

        {/* Density altitude */}
        {da && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">Density altitude</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Field elevation</dt>
                <dd className="font-bold tabular-nums">{ap.elevFt} ft</dd></div>
              <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Pressure altitude</dt>
                <dd className="font-bold tabular-nums">{da.pressureAltFt.toLocaleString('en')} ft</dd></div>
              <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Density altitude</dt>
                <dd className="font-bold tabular-nums" style={{ color: da.densityAltFt > ap.elevFt + 2000 ? 'var(--warn)' : 'var(--ok)' }}>
                  {da.densityAltFt.toLocaleString('en')} ft
                </dd></div>
            </dl>
            <p className="text-zinc-500 text-xs mt-3">Approximation (standard lapse rate, dry air) — verify with your POH performance charts.</p>
          </section>
        )}

        {/* TAF */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">TAF</h2>
          {taf?.rawTAF ? (
            <>
              {Array.isArray(taf.fcsts) && taf.fcsts.length > 0 && (
                <div className="space-y-2 text-sm mb-5">
                  {taf.fcsts.map((f, i) => {
                    const sig = sigWeather(f.wxString)
                    const ws = tafWindshear(f)
                    return (
                      <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-2 first:border-0 first:pt-0">
                        <span className="text-zinc-500 tabular-nums">{utc(f.timeFrom)} – {utc(f.timeTo)}</span>
                        {f.fcstChange && <span className="text-zinc-400">{f.fcstChange}</span>}
                        {typeof f.wdir === 'number' && <span className="tabular-nums">{String(f.wdir).padStart(3, '0')}°/{f.wspd} kt{f.wgst ? ` G${f.wgst}` : ''}</span>}
                        {f.visib != null && <span className="tabular-nums">{f.visib} SM</span>}
                        {f.wxString && (
                          <span style={sig.length ? { color: sig.some(s => s.severity === 'severe') ? 'var(--bad)' : 'var(--warn)', fontWeight: 700 } : undefined}>
                            {f.wxString}
                          </span>
                        )}
                        {ws && <span className="font-bold" style={{ color: 'var(--bad)' }}>{ws.label}</span>}
                        {Array.isArray(f.clouds) && f.clouds.length > 0 && (
                          <span className="text-zinc-400">{f.clouds.map(c => `${c.cover}${typeof c.base === 'number' ? String(Math.round(c.base / 100)).padStart(3, '0') : ''}`.trim()).join(' ')}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <code className="block text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg p-3 break-all whitespace-pre-wrap">
                {taf.rawTAF}
              </code>
            </>
          ) : (
            <p className="text-zinc-500 text-sm">No TAF issued for this field.</p>
          )}
        </section>

        <Link
          href={`/?city=${encodeURIComponent(ap.municipality ?? ap.name)}`}
          className="block text-center bg-emerald-400 text-black font-bold rounded-xl px-6 py-4 text-sm hover:bg-emerald-300 mb-10"
        >
          16-source consensus forecast for {ap.municipality ?? ap.name} →
        </Link>

        <Footer />
      </div>
    </main>
  )
}

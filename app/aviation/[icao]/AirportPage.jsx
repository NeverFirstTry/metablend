'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { sigWeather, ceilingCategory, visCategory, tafWindshear, RULES_COLOR } from '@/lib/metar'
import { wxText } from '@/lib/aviation-text'
import { useLang } from '@/lib/useLang'
import Footer from '../../components/Footer'

const pad3 = n => String(n).padStart(3, '0')

// One airport in the visitor's language. The server works out the numbers and renders it in
// English for search engines; the URL stays the same. METAR and TAF codes stay as they are.
export default function AirportPage({ ap, metar, taf, visSM, sky, rules, rulesKnown, flags, da, windOk, windVariable, metarSigSeverities, alerts, hasSevere, rvr, divergence, hasTempo, ends }) {
  const lang = useLang()
  const ceil = sky.ceilingFt
  const label = 'text-zinc-500 text-xs uppercase tracking-wider'
  const card = 'bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6'
  const heading = 'text-emerald-400 text-xs tracking-widest uppercase mb-4'
  const list = labels => labels.split(', ').map(l => wxText(lang, l)).join(', ')

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/aviation" className="app-only text-zinc-500 text-sm hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft size={15} aria-hidden /> {t(lang, 'back')}
          </Link>
          <nav className="text-zinc-500 text-xs flex gap-2">
            <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
            <span>/</span>
            <Link href="/aviation" className="hover:text-emerald-400">{t(lang, 'aviation')}</Link>
            <span>/</span>
            <span className="text-zinc-400">{ap.icao}</span>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {ap.icao} <span className="text-emerald-400">{ap.name}</span>
          </h1>
          {rules && (
            <span className="text-xs font-bold tracking-widest border rounded px-2 py-1" style={{ color: RULES_COLOR[rules], borderColor: RULES_COLOR[rules] }}>
              {rules}
            </span>
          )}
          {metar && !rulesKnown && (
            <span className="text-xs font-bold tracking-widest border border-zinc-600 text-zinc-400 rounded px-2 py-1">CAT N/A</span>
          )}
          {flags.map(f => (
            <span key={f} className="text-[0.625rem] tracking-widest border border-zinc-700 text-zinc-400 rounded px-1.5 py-0.5">{f}</span>
          ))}
        </div>
        <p className="text-zinc-500 text-sm mb-6 tracking-widest uppercase">
          {ap.municipality ? `${ap.municipality} · ` : ''}{ap.country}
          {ap.elevFt != null ? ` · ${fill(t(lang, 'avElev'), { ft: ap.elevFt })}` : ''}
        </p>

        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-red-200 text-xs mb-6 leading-relaxed">
          <strong>{t(lang, 'avNotFor')}</strong> {t(lang, 'avNotForShort')} <Link href="/terms#disclaimer" className="underline">{t(lang, 'legalDisclaimerLink')}</Link>
        </div>

        {alerts.length > 0 && (
          <div
            className={`border rounded-lg p-3 text-xs mb-6 leading-relaxed ${
              hasSevere ? 'bg-red-950/60 border-red-400/50 text-red-100' : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
            }`}
            role="alert"
          >
            <strong className="tracking-widest uppercase">⚠ {t(lang, 'avSig')}</strong>
            <ul className="mt-1.5 space-y-0.5">
              {alerts.map((a, i) => (
                <li key={i}>
                  <span className={a.severity === 'severe' ? 'font-bold' : ''}>{wxText(lang, a.label)}</span>
                  <span className="opacity-75">: {a.from ? fill(t(lang, 'avForecastTaf'), { from: a.from, to: a.to }) : t(lang, 'avNowMetar')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* METAR */}
        <section className={card}>
          <h2 className={heading}>METAR {metar?.reportUtc ? `· ${metar.reportUtc}` : ''}</h2>
          {metar ? (
            <>
              {/* Ceiling + visibility lead: they decide dispatch legality and
                  alternates, so they get the big numbers (dispatcher input). */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className={`${label} mb-1`}>{t(lang, 'avCeiling')}</div>
                  <div
                    className="text-2xl sm:text-3xl font-bold tabular-nums"
                    style={{
                      color: ceil != null ? RULES_COLOR[ceilingCategory(ceil)]
                        : sky.obscured ? RULES_COLOR.LIFR
                        : sky.unknownBase || !sky.known ? '#a1a1aa'
                        : RULES_COLOR.VFR,
                    }}
                  >
                    {ceil != null ? `${ceil.toLocaleString(lang)} ft`
                      : sky.obscured ? t(lang, 'avObscured')
                      : sky.unknownBase ? t(lang, 'avNotReported')
                      : sky.known ? t(lang, 'avNoCeiling') : '–'}
                  </div>
                  <div className="text-zinc-500 text-xs mt-1">
                    {t(lang, sky.obscured ? 'avSkyObscured' : sky.unknownBase && ceil == null ? 'avHeightMissing' : !sky.known ? 'avNoSky' : 'avLowest')}
                  </div>
                </div>
                <div>
                  <div className={`${label} mb-1`}>{t(lang, 'avVisibility')}</div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: visSM != null ? RULES_COLOR[visCategory(visSM)] : '#a1a1aa' }}>
                    {metar.visib != null ? `${metar.visib} SM` : '–'}
                  </div>
                  {rvr.length > 0 && (
                    <div className="text-zinc-400 text-xs mt-1 tabular-nums">RVR {rvr.map(r => `${r.rwy}: ${r.text}`).join(' · ')}</div>
                  )}
                </div>
              </div>
              {!rulesKnown && (
                <p className="text-amber-200/90 text-xs mb-5">
                  {fill(t(lang, 'avCatUnknown'), {
                    why: [
                      visSM == null && t(lang, 'avVisMissing'),
                      !sky.known && t(lang, 'avNoSky'),
                      sky.known && sky.unknownBase && t(lang, 'avCloudMissing'),
                    ].filter(Boolean).join(', '),
                  })}
                </p>
              )}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm mb-5">
                <div><dt className={label}>{t(lang, 'avWeather')}</dt>
                  <dd className="font-bold" style={metarSigSeverities.length ? { color: metarSigSeverities.includes('severe') ? 'var(--bad)' : 'var(--warn)' } : undefined}>
                    {metar.wxString ?? '–'}
                  </dd></div>
                <div><dt className={label}>{t(lang, 'windLabel')}</dt>
                  <dd className="font-bold tabular-nums">
                    {typeof metar.wdir === 'number' ? `${pad3(metar.wdir)}°` : metar.wdir ?? '–'}
                    {typeof metar.wspd === 'number' ? ` / ${metar.wspd} kt` : ''}
                    {metar.wgst ? ` G${metar.wgst}` : ''}
                  </dd></div>
                <div><dt className={label}>{t(lang, 'avTempDew')}</dt>
                  <dd className="font-bold tabular-nums">{metar.temp ?? '–'}° / {metar.dewp ?? '–'}°C</dd></div>
                <div><dt className={label}>QNH</dt>
                  <dd className="font-bold tabular-nums">{metar.altim ? `${Math.round(metar.altim)} hPa` : '–'}</dd></div>
              </dl>
              {Array.isArray(metar.clouds) && metar.clouds.length > 0 && (
                <p className="text-sm text-zinc-400 mb-4">
                  {fill(t(lang, 'avClouds'), { list: metar.clouds.map(c => `${c.cover}${c.base ? ` ${c.base} ft` : ''}`).join(', ') })}
                </p>
              )}
              <code className="block text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg p-3 break-all">{metar.rawOb}</code>
            </>
          ) : (
            <p className="text-zinc-500 text-sm">{t(lang, 'avNoMetar')}</p>
          )}
        </section>

        {/* Live TAF-vs-METAR divergence: is the forecast holding up right now? */}
        {divergence.length > 0 && (
          <section className={card}>
            <h2 className={heading}>{t(lang, 'avDivTitle')}</h2>
            <ul className="space-y-2 text-sm">
              {divergence.map((d, i) => (
                <li key={i} className="flex flex-wrap gap-x-2 items-baseline">
                  {d.field === 'weather' ? (
                    d.metar ? (
                      <>
                        <span className="font-bold" style={{ color: 'var(--bad)' }}>{list(d.metar)}</span>
                        <span className="text-zinc-400">{t(lang, 'avDivNotInTaf')}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold" style={{ color: 'var(--warn)' }}>{list(d.taf)}</span>
                        <span className="text-zinc-400">{t(lang, 'avDivNotSeen')}</span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="text-zinc-400">{t(lang, d.field === 'ceiling' ? 'avCeiling' : 'avVisibility')}:</span>
                      <span className="font-bold" style={{ color: RULES_COLOR[d.metar] }}>METAR {d.metar}</span>
                      <span className="text-zinc-500">{t(lang, 'avVs')}</span>
                      <span className="font-bold" style={{ color: RULES_COLOR[d.taf] }}>TAF {d.taf}</span>
                      <span className="text-zinc-400">{t(lang, d.tafOptimistic ? 'avDivWorse' : 'avDivBetter')}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-zinc-500 text-xs mt-3">{t(lang, 'avDivNote')}{hasTempo ? ` ${t(lang, 'avDivTempo')}` : ''}</p>
          </section>
        )}

        {/* Crosswind */}
        {ends.length > 0 && (
          <section tabIndex={0} aria-label={t(lang, 'avRwyTitle')} className={`${card} overflow-x-auto`}>
            <h2 className={heading}>{t(lang, 'avRwyTitle')} · {fill(t(lang, 'avRwyWind'), { dir: pad3(metar.wdir), kt: metar.wspd })}</h2>
            <table className="w-full text-sm text-left min-w-[420px]">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4 font-normal">RWY</th>
                  <th className="py-2 pr-4 font-normal">{t(lang, 'avHeading')}</th>
                  <th className="py-2 pr-4 font-normal">{t(lang, 'avHeadTail')}</th>
                  <th className="py-2 pr-4 font-normal">{t(lang, 'avCross')}</th>
                  <th className="py-2 font-normal">{t(lang, 'avLength')}</th>
                </tr>
              </thead>
              <tbody>
                {ends.map((e, i) => (
                  <tr key={`${e.ident}-${i}`} className="border-t border-zinc-800">
                    <td className={`py-2 pr-4 font-bold ${i === 0 ? 'text-emerald-400' : ''}`}>{e.ident}{i === 0 ? ' ★' : ''}</td>
                    <td className="py-2 pr-4 tabular-nums">{pad3(e.hdg)}°</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: e.w.headKt >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                      {e.w.headKt >= 0 ? fill(t(lang, 'avHead'), { kt: e.w.headKt }) : fill(t(lang, 'avTail'), { kt: -e.w.headKt })}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {Math.abs(e.w.crossKt)} kt {e.w.crossKt === 0 ? '' : t(lang, e.w.crossKt > 0 ? 'avFromR' : 'avFromL')}
                    </td>
                    <td className="py-2 tabular-nums">{e.len ? `${e.len} ft` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-zinc-500 text-xs mt-3">{t(lang, 'avBest')}</p>
          </section>
        )}

        {windVariable && (
          <section className={card}>
            <h2 className={heading}>{t(lang, 'avRwyTitle')}</h2>
            <p className="text-sm text-zinc-300">
              {fill(t(lang, 'avVariable'), { dir: typeof metar.wdir === 'string' ? metar.wdir : 'VRB', kt: metar.wspd, max: metar.wgst ?? metar.wspd })}
              {metar.wgst ? ` ${fill(t(lang, 'avGust'), { kt: metar.wgst })}` : ''}
            </p>
          </section>
        )}

        {/* Density altitude */}
        {da && (
          <section className={card}>
            <h2 className={heading}>{t(lang, 'avDa')}</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div><dt className={label}>{t(lang, 'avFieldElev')}</dt>
                <dd className="font-bold tabular-nums">{ap.elevFt} ft</dd></div>
              <div><dt className={label}>{t(lang, 'avPressAlt')}</dt>
                <dd className="font-bold tabular-nums">{da.pressureAltFt.toLocaleString(lang)} ft</dd></div>
              <div><dt className={label}>{t(lang, 'avDa')}</dt>
                <dd className="font-bold tabular-nums" style={{ color: da.densityAltFt > ap.elevFt + 2000 ? 'var(--warn)' : 'var(--ok)' }}>
                  {da.densityAltFt.toLocaleString(lang)} ft
                </dd></div>
            </dl>
            <p className="text-zinc-500 text-xs mt-3">{t(lang, 'avDaNote')}</p>
          </section>
        )}

        {/* TAF */}
        <section className={card}>
          <h2 className={heading}>TAF</h2>
          {taf ? (
            <>
              {taf.fcsts.length > 0 && (
                <div className="space-y-2 text-sm mb-5">
                  {taf.fcsts.map((f, i) => {
                    const sig = sigWeather(f.wxString)
                    const ws = tafWindshear(f)
                    return (
                      <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-2 first:border-0 first:pt-0">
                        <span className="text-zinc-500 tabular-nums">{f.fromUtc} – {f.toUtc}</span>
                        {f.fcstChange && <span className="text-zinc-400">{f.fcstChange}</span>}
                        {typeof f.wdir === 'number' && <span className="tabular-nums">{pad3(f.wdir)}°/{f.wspd} kt{f.wgst ? ` G${f.wgst}` : ''}</span>}
                        {f.visib != null && <span className="tabular-nums">{f.visib} SM</span>}
                        {f.wxString && (
                          <span style={sig.length ? { color: sig.some(s => s.severity === 'severe') ? 'var(--bad)' : 'var(--warn)', fontWeight: 700 } : undefined}>
                            {f.wxString}
                          </span>
                        )}
                        {ws && <span className="font-bold" style={{ color: 'var(--bad)' }}>{wxText(lang, ws.label)}</span>}
                        {Array.isArray(f.clouds) && f.clouds.length > 0 && (
                          <span className="text-zinc-400">{f.clouds.map(c => `${c.cover}${typeof c.base === 'number' ? String(Math.round(c.base / 100)).padStart(3, '0') : ''}`.trim()).join(' ')}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <code className="block text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg p-3 break-all whitespace-pre-wrap">{taf.rawTAF}</code>
            </>
          ) : (
            <p className="text-zinc-500 text-sm">{t(lang, 'avNoTaf')}</p>
          )}
        </section>

        <Link
          href={`/?city=${encodeURIComponent(ap.municipality ?? ap.name)}`}
          className="press block text-center bg-emerald-400 text-black font-bold rounded-xl px-6 py-4 text-sm hover:bg-emerald-300 mb-10"
        >
          {fill(t(lang, 'avConsensus'), { name: ap.municipality ?? ap.name })}
        </Link>

        <Footer lang={lang} />
      </div>
    </main>
  )
}

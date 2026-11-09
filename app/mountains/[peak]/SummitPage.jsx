'use client'

import Link from 'next/link'
import { t } from '@/lib/i18n'
import { fill, tempFormatter } from '@/lib/outlook/text'
import { windowText } from '@/lib/hike/text'
import { formatCalendarDate } from '@/lib/localtime'
import { AVA_COLORS } from '@/lib/avalanche/avalanche'
import { useLang } from '@/lib/useLang'
import { useUnit } from '@/lib/useUnit'
import StoreBadges from '../../components/hike/StoreBadges'
import Footer from '../../components/Footer'
import Glyph from '../../components/Glyph'

// One summit in the visitor's language and unit. The server renders it in English for
// search engines; the URL stays the same in every language.
export default function SummitPage({ peak, days, windows, todayLocal, tomorrowLocal, stormUnknown, sources, ava, nearby }) {
  const lang = useLang()
  const fmt = tempFormatter(useUnit())
  const today = windows?.today !== undefined ? windowText(lang, windows.today, { date: todayLocal, todayLocal, stormUnknown }) : null
  const tomorrow = windows?.tomorrow !== undefined && tomorrowLocal ? windowText(lang, windows.tomorrow, { date: tomorrowLocal, todayLocal, stormUnknown }) : null
  const day = date => (date === todayLocal ? t(lang, 'tabToday') : formatCalendarDate(date, lang, { weekday: 'short', month: 'short', day: 'numeric' }))
  const avaDays = [[t(lang, 'avaToday'), ava?.today], [t(lang, 'avaTomorrow'), ava?.tomorrow]].filter(([, l]) => l)
  const region = t(lang, `region_${peak.region}`)
  const columns = [t(lang, 'colLowHigh'), t(lang, 'summitWind'), t(lang, 'colRain'), t(lang, 'freezingLevel'), t(lang, 'stormRisk')]

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6 flex flex-wrap gap-2">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span>/</span>
          <Link href="/mountains" className="hover:text-emerald-400">{t(lang, 'footerMountains')}</Link>
          <span>/</span>
          <span className="text-zinc-400">{peak.name}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">{fill(t(lang, 'mtnPageTitle'), { name: peak.name })}</h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          {fill(t(lang, 'mtnAtElev'), { elev: peak.elev })} · {region}{peak.country ? ` · ${peak.country}` : ''}{peak.grade ? ` · SAC ${peak.grade}` : ''}
        </p>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">{t(lang, 'mtnWindow')}</h2>
          {today && <p className="text-xl font-bold">{today.title}</p>}
          {today?.sub && <p className="text-sm text-zinc-400 mt-1">{today.sub}</p>}
          {tomorrow && <p className="text-sm text-zinc-300 mt-4">{tomorrow.title}{tomorrow.sub ? `: ${tomorrow.sub}` : ''}</p>}
          <p className="text-xs text-zinc-500 mt-4">{t(lang, 'hikeDisclaimer')} <Link href="/terms#disclaimer" className="underline hover:text-emerald-400">{t(lang, 'legalDisclaimerLink')}</Link></p>
        </section>

        {avaDays.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">{t(lang, 'avaTitle')}</h2>
            <ul className="space-y-2 text-sm">
              {avaDays.map(([label, level]) => (
                <li key={label} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="w-20 text-zinc-400">{label}</span>
                  <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded font-bold text-xs" style={{ background: AVA_COLORS[level], color: level === 5 ? '#fff' : '#111' }}>{level}</span>
                  <span className="font-bold"><span className="sr-only">{level}: </span>{t(lang, `avaLevel${level}`)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-500 mt-3">{t(lang, 'avaNote')} · <a href="https://avalanches.org/" className="underline hover:text-emerald-400">{t(lang, 'avaSource')}</a></p>
          </section>
        )}

        {days?.length > 0 && (
          <section aria-label={t(lang, 'mtn7Day')} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">{t(lang, 'mtn7Day')}</h2>
            {/* a phone stacks each day in three columns, with a label above each value (.stack-table) */}
            <table role="table" className="stack-table w-full text-sm text-left">
              <thead role="rowgroup">
                <tr role="row" className="text-zinc-500 text-xs uppercase tracking-wider">
                  <th role="columnheader" className="py-2 pr-4 font-normal">{t(lang, 'colDay')}</th>
                  {columns.map((c, i) => <th key={c} role="columnheader" className={`py-2 font-normal ${i < columns.length - 1 ? 'pr-4' : ''}`}>{c}</th>)}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {days.map(x => (
                  <tr key={x.date} role="row" className="border-t border-zinc-800">
                    <td role="cell" className="py-2 pr-4 whitespace-nowrap"><Glyph emoji={x.icon} size={16} /> {day(x.date)}</td>
                    <td role="cell" data-label={columns[0]} className="py-2 pr-4 tabular-nums">{fmt(x.tempMin)} / {fmt(x.tempMax)}</td>
                    <td role="cell" data-label={columns[1]} className="py-2 pr-4 tabular-nums">{x.windMax != null ? `${x.windMax} km/h` : '–'}</td>
                    <td role="cell" data-label={columns[2]} className="py-2 pr-4 tabular-nums">{x.rainPct != null ? `${x.rainPct}%` : '–'}</td>
                    <td role="cell" data-label={columns[3]} className="py-2 pr-4 tabular-nums">{x.freezingMin != null ? `${x.freezingMin}-${x.freezingMax} m` : '–'}</td>
                    <td role="cell" data-label={columns[4]} className="py-2">{x.storm ? t(lang, `storm${x.storm[0].toUpperCase()}${x.storm.slice(1)}`) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sources?.length > 0 && (
              <p className="text-zinc-500 text-xs mt-3">{fill(t(lang, 'mtnBlend'), { elev: peak.elev, n: sources.length, list: sources.join(', ') })}</p>
            )}
          </section>
        )}

        <section className="bg-zinc-900 border border-emerald-400/30 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold mb-2">{t(lang, 'hikeTeaserTitle')}</h2>
          <p className="text-sm text-zinc-300 mb-4">{fill(t(lang, 'mtnAppText'), { name: peak.name })}</p>
          <StoreBadges lang={lang} />
        </section>

        {nearby.length > 0 && (
          <section className="mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-3">{fill(t(lang, 'mtnMore'), { region })}</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {nearby.map(p => (
                <li key={p.id}><Link href={`/mountains/${p.id}`} className="press inline-block rounded-lg border border-zinc-800 px-3 py-1.5 hover:border-emerald-400">{p.name} <span className="text-zinc-500">{p.elev} m</span></Link></li>
              ))}
            </ul>
          </section>
        )}
        <Footer lang={lang} />
      </div>
    </main>
  )
}

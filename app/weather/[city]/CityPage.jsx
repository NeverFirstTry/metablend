'use client'

import Link from 'next/link'
import { t, translateCondition } from '@/lib/i18n'
import { fill, headlineText, tempFormatter, spanFormatter } from '@/lib/outlook/text'
import { formatCalendarDate } from '@/lib/localtime'
import { useLang } from '@/lib/useLang'
import { useUnit } from '@/lib/useUnit'
import Footer from '../../components/Footer'
import Glyph from '../../components/Glyph'

// A gap to normal in whole degrees, with a real minus sign and the unit's scale.
const wholeDelta = (d, unit) => {
  const v = Math.round(unit === 'F' ? d * 9 / 5 : d)
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}°`
}

// One city in the visitor's language and unit. The server renders it in English for
// search engines; the URL stays the same in every language.
export default function CityPage({ name, country, consensus, condition, sourceCount, topWeights, others, outlook }) {
  const lang = useLang()
  const unit = useUnit()
  const fmt = tempFormatter(unit)
  const todayLocal = outlook?.nowLocal?.slice(0, 10)
  const words = { todayLocal, fmtTemp: fmt, fmtSpan: spanFormatter(unit) }
  const today = outlook ? headlineText(lang, 'today', outlook.headlines?.today, words) : null
  const tomorrow = outlook ? headlineText(lang, 'tomorrow', outlook.headlines?.tomorrow, words) : null
  const week = outlook?.days ?? []
  const weekday = d => formatCalendarDate(d, lang, { weekday: 'short', month: 'short', day: 'numeric' })
  const dt = 'text-zinc-500 text-xs uppercase tracking-wider'

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <nav className="text-zinc-500 text-xs mb-6 flex flex-wrap gap-2">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span>/</span>
          <Link href="/weather" className="hover:text-emerald-400">{t(lang, 'footerCities')}</Link>
          <span>/</span>
          <span className="text-zinc-400">{name}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">{fill(t(lang, 'shareTitle'), { city: name })}</h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          {fill(t(lang, 'citySub'), { n: sourceCount })}{country ? ` · ${country}` : ''}
        </p>

        {/* Current consensus */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">{t(lang, 'lbRightNow')}</h2>
          <div className="flex flex-wrap items-end gap-6">
            <div className="text-6xl sm:text-7xl font-bold tabular-nums leading-none">{fmt(consensus.temp)}</div>
            <div className="text-zinc-300 pb-1">
              {condition && <div className="text-lg font-bold">{translateCondition(lang, condition)}</div>}
              <div className="text-sm text-zinc-500">{t(lang, 'feelsLike')} {fmt(consensus.feelsLike)}</div>
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-6 text-sm">
            <div><dt className={dt}>{t(lang, 'rainChanceLabel')}</dt><dd className="font-bold tabular-nums">{consensus.rainPct != null ? `${consensus.rainPct}%` : '–'}</dd></div>
            <div><dt className={dt}>{t(lang, 'windLabel')}</dt><dd className="font-bold tabular-nums">{consensus.windKmh} km/h</dd></div>
            <div><dt className={dt}>{t(lang, 'cityAgreement')}</dt><dd className="font-bold tabular-nums">{consensus.confidencePct}%</dd></div>
            {outlook?.sun?.sunrise && (
              <div><dt className={dt}>{t(lang, 'citySun')}</dt><dd className="font-bold tabular-nums">{outlook.sun.sunrise} – {outlook.sun.sunset}</dd></div>
            )}
          </dl>
          {(today || tomorrow) && (
            <p className="mt-5 text-sm text-zinc-300">
              {/* both titles name their day ("… tonight", "Dry tomorrow") */}
              {fill(t(lang, 'cityOutlook'), { name })} {[today, tomorrow].filter(Boolean).map(h => `${h.title}${h.sub ? ` (${h.sub})` : ''}.`).join(' ')}
            </p>
          )}
        </section>

        {/* 7-day, as a real table (crawlable) */}
        {week.length > 0 && (
          <section tabIndex={0} aria-label={t(lang, 'city7Day')} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6 overflow-x-auto">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">{t(lang, 'city7Day')}</h2>
            {/* fits a phone: there the conditions show as their icon (the words stay for screen readers and search) */}
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-3 sm:pr-4 font-normal">{t(lang, 'colDay')}</th>
                  <th className="py-2 pr-3 sm:pr-4 font-normal"><span className="sr-only sm:not-sr-only">{t(lang, 'conditionLabel')}</span></th>
                  <th className="py-2 pr-3 sm:pr-4 font-normal whitespace-nowrap">{t(lang, 'highLowLabel')}</th>
                  <th className="py-2 pr-3 sm:pr-4 font-normal">{t(lang, 'colRain')}</th>
                  <th className="py-2 font-normal">{t(lang, 'windLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {week.map(d => (
                  <tr key={d.date} className="border-t border-zinc-800">
                    <td className="py-2 pr-3 sm:pr-4 whitespace-nowrap">{weekday(d.date)}</td>
                    <td className="py-2 pr-3 sm:pr-4"><Glyph emoji={d.icon} size={16} /> <span className="sr-only sm:not-sr-only">{d.condition ? translateCondition(lang, d.condition) : ''}</span></td>
                    <td className="py-2 pr-3 sm:pr-4 tabular-nums whitespace-nowrap">{fmt(d.tempMax)} / {fmt(d.tempMin)}</td>
                    <td className="py-2 pr-3 sm:pr-4 tabular-nums">{d.rainPct != null ? `${d.rainPct}%` : '–'}</td>
                    <td className="py-2 tabular-nums whitespace-nowrap">{d.windKmh != null ? `${d.windKmh} km/h` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {outlook.sources?.length > 0 && (
              <p className="text-zinc-500 text-xs mt-3">{fill(t(lang, 'cityBlend'), { n: outlook.sources.length, list: outlook.sources.join(', ') })}</p>
            )}
          </section>
        )}

        {/* What makes this different — unique per-city content */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">{t(lang, 'cityHowTitle')}</h2>
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">{fill(t(lang, 'cityHowText'), { n: sourceCount, name })}</p>
          {topWeights.length > 0 && <p className="text-sm text-zinc-400 leading-relaxed">{fill(t(lang, 'cityTrusted'), { list: topWeights.join(', ') })}</p>}
          {outlook?.vsNormal?.week1 != null && (
            <p className="text-sm text-zinc-400 leading-relaxed mt-3">
              {fill(t(lang, 'cityVsNormal'), { delta: wholeDelta(outlook.vsNormal.week1, unit), name })}{' '}
              {fill(t(lang, 'cityRainyDays'), { n: outlook.rainyDays.forecast, total: outlook.rainyDays.of })}
              {outlook.rainyDays.normal != null ? ` (${fill(t(lang, 'normalValue'), { n: outlook.rainyDays.normal })})` : ''}
            </p>
          )}
        </section>

        {/* CTA into the interactive app */}
        <Link
          href={`/?city=${encodeURIComponent(name)}`}
          className="press block text-center bg-emerald-400 text-black font-bold rounded-xl px-6 py-4 text-sm hover:bg-emerald-300 mb-10"
        >
          {fill(t(lang, 'cityOpen'), { name, n: sourceCount })}
        </Link>

        {/* Crawl mesh: other cities */}
        <section>
          <h2 className="text-zinc-500 text-xs tracking-widest uppercase mb-3">{t(lang, 'cityOthers')}</h2>
          <div className="flex flex-wrap gap-2">
            {others.map(c => (
              <Link
                key={c.slug}
                href={`/weather/${c.slug}`}
                className="press bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
              >
                {c.name}
              </Link>
            ))}
            <Link href="/weather" className="press bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-emerald-400 hover:border-emerald-400">
              {t(lang, 'cityAll')}
            </Link>
          </div>
        </section>

        <Footer lang={lang} />
      </div>
    </main>
  )
}

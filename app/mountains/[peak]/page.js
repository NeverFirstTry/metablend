import Link from 'next/link'
import { notFound } from 'next/navigation'
import featured from '@/lib/hike/featured.json'
import { hikeApiPath } from '@/lib/hike/params'
import { windowText } from '@/lib/hike/text'
import { formatCalendarDate } from '@/lib/localtime'
import { t } from '@/lib/i18n'
import { jsonForScript } from '@/lib/html'
import { AVA_COLORS } from '@/lib/avalanche/avalanche'
import StoreBadges from '../../components/hike/StoreBadges'
import Footer from '../../components/Footer'

// Server-rendered summit weather for each featured peak: the summit window,
// a 7-day summit table and (in winter) the avalanche danger, in crawlable
// HTML — "Großglockner weather" lands here, the app has the rest. Rendered on
// demand and ISR-cached for 30 minutes, like the summit forecast itself.
export const revalidate = 1800

// self-fetches go through the public domain (the raw deployment URL is behind
// deployment protection); SELF_BASE for a local `next start` on another port
const BASE = process.env.SELF_BASE ?? (process.env.VERCEL_ENV ? 'https://metablend.app' : 'http://localhost:3000')
const peakById = id => featured.find(p => p.id === id && p.kind !== 'hut') ?? null

async function getSummit(peak) {
  const res = await fetch(`${BASE}${hikeApiPath(peak)}`, { next: { revalidate: 1800 } })
  if (!res.ok) throw new Error(`hike api ${res.status}`) // 500 → crawlers retry instead of dropping the page
  return res.json()
}
async function getAvalanche(peak) {
  try {
    const res = await fetch(`${BASE}/api/avalanche?lat=${peak.lat.toFixed(2)}&lon=${peak.lon.toFixed(2)}`, { next: { revalidate: 1800 } })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const peak = peakById((await params).peak)
  if (!peak) return {}
  return {
    title: `${peak.name} Weather — Summit Forecast (${peak.elev} m)`,
    description:
      `${peak.name} summit weather at ${peak.elev} m: today's safe summit window, wind up top, ` +
      `freezing level and thunderstorm risk for 7 days — blended from up to 9 weather models.`,
    alternates: { canonical: `/mountains/${peak.id}` },
  }
}

export default async function MountainWeather({ params }) {
  const peak = peakById((await params).peak)
  if (!peak) notFound()
  const [d, ava] = await Promise.all([getSummit(peak), getAvalanche(peak)])
  const todayLocal = d.nowLocal?.slice(0, 10)
  const tomorrowLocal = d.days?.[1]?.date
  const stormUnknown = !!d.notes?.includes('no_storm_data')
  const today = d.windows?.today !== undefined ? windowText('en', d.windows.today, { date: todayLocal, todayLocal, stormUnknown }) : null
  const tomorrow = d.windows?.tomorrow !== undefined && tomorrowLocal ? windowText('en', d.windows.tomorrow, { date: tomorrowLocal, todayLocal, stormUnknown }) : null
  const day = date => (date === todayLocal ? 'Today' : formatCalendarDate(date, 'en', { weekday: 'short', month: 'short', day: 'numeric' }))
  const avaDays = [['Today', ava?.today], ['Tomorrow', ava?.tomorrow]].filter(([, l]) => l)
  const nearby = featured
    .filter(p => p.region === peak.region && p.id !== peak.id && p.kind !== 'hut')
    .slice(0, 10)

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonForScript({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'MetaBlend', item: 'https://metablend.app' },
                { '@type': 'ListItem', position: 2, name: 'Mountains', item: 'https://metablend.app/mountains' },
                { '@type': 'ListItem', position: 3, name: `${peak.name} weather` },
              ],
            }),
          }}
        />

        <nav className="text-zinc-500 text-xs mb-6 flex gap-2">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span>/</span>
          <Link href="/mountains" className="hover:text-emerald-400">Mountains</Link>
          <span>/</span>
          <span className="text-zinc-400">{peak.name}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
          {peak.name} <span className="text-emerald-400">Weather</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          Summit forecast at {peak.elev} m · {t('en', `region_${peak.region}`)}{peak.country ? ` · ${peak.country}` : ''}{peak.grade ? ` · SAC ${peak.grade}` : ''}
        </p>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">Summit window</h2>
          {today && <p className="text-xl font-bold">{today.title}</p>}
          {today?.sub && <p className="text-sm text-zinc-400 mt-1">{today.sub}</p>}
          {tomorrow && <p className="text-sm text-zinc-300 mt-4">{tomorrow.title}{tomorrow.sub ? ` — ${tomorrow.sub}` : ''}</p>}
          <p className="text-xs text-zinc-500 mt-4">{t('en', 'hikeDisclaimer')}</p>
        </section>

        {avaDays.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">Avalanche danger</h2>
            <ul className="space-y-2 text-sm">
              {avaDays.map(([label, level]) => (
                <li key={label} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="w-20 text-zinc-400">{label}</span>
                  <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded font-bold text-xs" style={{ background: AVA_COLORS[level], color: level === 5 ? '#fff' : '#111' }}>{level}</span>
                  <span className="font-bold"><span className="sr-only">{level} – </span>{t('en', `avaLevel${level}`)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-500 mt-3">{t('en', 'avaNote')} · <a href="https://avalanches.org/" className="underline hover:text-emerald-400">{t('en', 'avaSource')}</a></p>
          </section>
        )}

        {d.days?.length > 0 && (
          <section tabIndex={0} aria-label="7-day summit forecast" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6 overflow-x-auto">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">7-day summit forecast</h2>
            <table className="w-full text-sm text-left min-w-[480px]">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4 font-normal">Day</th>
                  <th className="py-2 pr-4 font-normal">Low / High</th>
                  <th className="py-2 pr-4 font-normal">Summit wind</th>
                  <th className="py-2 pr-4 font-normal">Rain</th>
                  <th className="py-2 pr-4 font-normal">Freezing level</th>
                  <th className="py-2 font-normal">Storm risk</th>
                </tr>
              </thead>
              <tbody>
                {d.days.map(x => (
                  <tr key={x.date} className="border-t border-zinc-800">
                    <td className="py-2 pr-4 whitespace-nowrap">{x.icon ?? ''} {day(x.date)}</td>
                    <td className="py-2 pr-4 tabular-nums">{Math.round(x.tempMin)}° / {Math.round(x.tempMax)}°</td>
                    <td className="py-2 pr-4 tabular-nums">{x.windMax != null ? `${x.windMax} km/h` : '–'}</td>
                    <td className="py-2 pr-4 tabular-nums">{x.rainPct != null ? `${x.rainPct}%` : '–'}</td>
                    <td className="py-2 pr-4 tabular-nums">{x.freezingMin != null ? `${x.freezingMin}–${x.freezingMax} m` : '–'}</td>
                    <td className="py-2">{x.storm ? t('en', `storm${x.storm[0].toUpperCase()}${x.storm.slice(1)}`) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-zinc-500 text-xs mt-3">
              Temperatures at the summit ({peak.elev} m), blended from {d.sources?.length ?? 'several'} weather models
              {d.sources?.length ? ` (${d.sources.map(s => s.name).join(', ')})` : ''}.
            </p>
          </section>
        )}

        <section className="bg-zinc-900 border border-emerald-400/30 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold mb-2">{t('en', 'hikeTeaserTitle')}</h2>
          <p className="text-sm text-zinc-300 mb-4">
            Hour-by-hour summit weather for {peak.name}, alerts the evening before and the morning of a planned hike,
            marked routes with the best start time — free, no account.
          </p>
          <StoreBadges lang="en" />
          <p className="text-xs text-zinc-500 mt-3"><Link href="/testers" className="underline hover:text-emerald-400">Try the app now as a tester</Link></p>
        </section>

        {nearby.length > 0 && (
          <section className="mb-6">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-3">More summits in the {t('en', `region_${peak.region}`)}</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {nearby.map(p => (
                <li key={p.id}><Link href={`/mountains/${p.id}`} className="inline-block rounded-lg border border-zinc-800 px-3 py-1.5 hover:border-emerald-400">{p.name} <span className="text-zinc-500">{p.elev} m</span></Link></li>
              ))}
            </ul>
          </section>
        )}
        <Footer />
      </div>
    </main>
  )
}

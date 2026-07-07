import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CITIES, findCity, slugToQuery } from '@/lib/cities'
import Footer from '../../components/Footer'

// Server-rendered per-city weather page: real consensus data in crawlable
// HTML. No build-time generation (that would burn upstream API quota on every
// deploy) — pages render on demand and are ISR-cached for 15 minutes, same
// rhythm as the API's own cache.
export const revalidate = 900

const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase())

function displayName(slug) {
  return findCity(slug)?.name ?? titleCase(slugToQuery(slug))
}

async function getForecast(slug) {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
  try {
    const res = await fetch(`${base}/api/forecast?city=${encodeURIComponent(slugToQuery(slug))}`, {
      next: { revalidate: 900 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.error ? null : json
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const { city } = await params
  const name = displayName(city)
  return {
    title: `${name} Weather — 16-Source Consensus Forecast`,
    description:
      `Live consensus weather for ${name}: current temperature, rain probability, wind and ` +
      `a 7-day forecast blended from 16 weather services (ECMWF, GFS, ICON, Open-Meteo and more), ` +
      `weighted by real measured accuracy.`,
    alternates: { canonical: `/weather/${city}` },
  }
}

export default async function CityWeather({ params }) {
  const { city } = await params
  const data = await getForecast(city)
  if (!data) notFound()

  const name = data.city ?? displayName(city)
  const condition =
    data.sources?.find(s => s.apiId === 'open-meteo' && !s.down)?.condition ??
    data.sources?.find(s => !s.down && s.condition)?.condition ?? null
  const upSources = (data.sources ?? []).filter(s => !s.down)
  const topWeights = Object.entries(data.weights ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, w]) => ({ id, name: upSources.find(s => s.apiId === id)?.displayName ?? id, pct: (w * 100).toFixed(1) }))
  const others = CITIES.filter(c => c.slug !== city).slice(0, 12)
  const weekday = d => new Date(d).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'MetaBlend', item: 'https://metablend.app' },
                { '@type': 'ListItem', position: 2, name: 'Cities', item: 'https://metablend.app/weather' },
                { '@type': 'ListItem', position: 3, name: `${name} weather` },
              ],
            }),
          }}
        />

        <nav className="text-zinc-500 text-xs mb-6 flex gap-2">
          <Link href="/" className="hover:text-emerald-400">MetaBlend</Link>
          <span>/</span>
          <Link href="/weather" className="hover:text-emerald-400">Cities</Link>
          <span>/</span>
          <span className="text-zinc-400">{name}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
          {name} <span className="text-emerald-400">Weather</span>
        </h1>
        <p className="text-zinc-500 text-sm mb-8 tracking-widest uppercase">
          Consensus of {upSources.length} weather sources{data.country ? ` · ${data.country}` : ''}
        </p>

        {/* Current consensus */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">Right now</h2>
          <div className="flex flex-wrap items-end gap-6">
            <div className="text-6xl sm:text-7xl font-bold tabular-nums leading-none">
              {data.consensus.temp}°C
            </div>
            <div className="text-zinc-300 pb-1">
              {condition && <div className="text-lg font-bold">{condition}</div>}
              <div className="text-sm text-zinc-500">feels like {data.consensus.feelsLike}°C</div>
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-6 text-sm">
            <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Rain probability</dt><dd className="font-bold tabular-nums">{data.consensus.rainPct != null ? `${data.consensus.rainPct}%` : '–'}</dd></div>
            <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Wind</dt><dd className="font-bold tabular-nums">{data.consensus.windKmh} km/h</dd></div>
            <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Source agreement</dt><dd className="font-bold tabular-nums">{data.consensus.confidencePct}%</dd></div>
            {data.sunrise && data.sunrise !== '–' && (
              <div><dt className="text-zinc-500 text-xs uppercase tracking-wider">Sun</dt><dd className="font-bold tabular-nums">{data.sunrise} – {data.sunset}</dd></div>
            )}
          </dl>
          {data.willRain != null && (
            <p className="mt-5 text-sm text-zinc-300">
              {data.willRain
                ? `Yes — rain is expected in ${name} today (${data.consensus.rainPct}% probability across the sources that forecast rain).`
                : `No rain expected in ${name} today (${data.consensus.rainPct}% probability across the sources that forecast rain).`}
            </p>
          )}
        </section>

        {/* 7-day, as a real table (crawlable) */}
        {data.forecast7?.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6 overflow-x-auto">
            <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">7-day consensus forecast</h2>
            <table className="w-full text-sm text-left min-w-[420px]">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4 font-normal">Day</th>
                  <th className="py-2 pr-4 font-normal">Conditions</th>
                  <th className="py-2 pr-4 font-normal">High / Low</th>
                  <th className="py-2 pr-4 font-normal">Rain</th>
                  <th className="py-2 font-normal">Wind</th>
                </tr>
              </thead>
              <tbody>
                {data.forecast7.map(d => (
                  <tr key={d.date} className="border-t border-zinc-800">
                    <td className="py-2 pr-4 whitespace-nowrap">{weekday(d.date)}</td>
                    <td className="py-2 pr-4">{d.icon} {d.condition}</td>
                    <td className="py-2 pr-4 tabular-nums">{d.tempMax}° / {d.tempMin}°</td>
                    <td className="py-2 pr-4 tabular-nums">{d.rainPct != null ? `${d.rainPct}%` : '–'}</td>
                    <td className="py-2 tabular-nums">{d.windKmh} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-zinc-500 text-xs mt-3">
              Each day blends five independent daily forecasts (Open-Meteo, GFS, ICON, ECMWF, MET Norway),
              weighted by measured accuracy.
            </p>
          </section>
        )}

        {/* What makes this different — unique per-city content */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-emerald-400 text-xs tracking-widest uppercase mb-4">How this forecast is made</h2>
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">
            MetaBlend queried {upSources.length} weather services for {name} and blended them into one
            consensus, weighting each source by how accurate it has actually been — measured hourly against
            airport weather observations and community reports.
          </p>
          {topWeights.length > 0 && (
            <p className="text-sm text-zinc-400 leading-relaxed">
              Currently most trusted here: {topWeights.map(t => `${t.name} (${t.pct}%)`).join(', ')}.
            </p>
          )}
          {data.climate?.avgTemp != null && (
            <p className="text-sm text-zinc-400 leading-relaxed mt-3">
              Historically, this month in {name} averages {data.climate.avgTemp}°C with about{' '}
              {data.climate.avgRainyDays} rainy days (10 years of climate data).
            </p>
          )}
        </section>

        {/* CTA into the interactive app */}
        <Link
          href={`/?city=${encodeURIComponent(name)}`}
          className="block text-center bg-emerald-400 text-black font-bold rounded-xl px-6 py-4 text-sm hover:bg-emerald-300 mb-10"
        >
          Open {name} in the live app — radar, hourly detail &amp; all {upSources.length} sources →
        </Link>

        {/* Crawl mesh: other cities */}
        <section>
          <h2 className="text-zinc-500 text-xs tracking-widest uppercase mb-3">Weather in other cities</h2>
          <div className="flex flex-wrap gap-2">
            {others.map(c => (
              <Link
                key={c.slug}
                href={`/weather/${c.slug}`}
                className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-zinc-300 hover:border-emerald-400 hover:text-emerald-400"
              >
                {c.name}
              </Link>
            ))}
            <Link href="/weather" className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-xs text-emerald-400 hover:border-emerald-400">
              All cities →
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  )
}

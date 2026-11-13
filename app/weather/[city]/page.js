import { jsonForScript } from '@/lib/html'
import { notFound } from 'next/navigation'
import { CITIES, findCity, slugToQuery } from '@/lib/cities'
import { heroCondition } from '@/lib/conditions'
import { blendShares } from '@/lib/consensus'
import { readForecast } from '@/lib/weather-page'
import { atNow } from '@/lib/outlook/at-now'
import CityPage from './CityPage'

// Server-rendered per-city weather page: real consensus data in crawlable
// HTML. No build-time generation (that would burn upstream API quota on every
// deploy) — pages render on demand and are ISR-cached for 15 minutes, same
// rhythm as the API's own cache.
export const revalidate = 900

// On-demand caching: no pages are built ahead; each is rendered on its first
// visit and then served from the cache for `revalidate` seconds. Without
// this a dynamic route renders on every request and revalidate is ignored.
export async function generateStaticParams() { return [] }

const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase())

function displayName(slug) {
  return findCity(slug)?.name ?? titleCase(slugToQuery(slug))
}

// Self-fetch goes through the public production domain, NOT VERCEL_URL — the
// raw deployment URL sits behind Vercel's deployment protection and 401s
// server-to-server fetches. Returns the payload, 'unknown' for a city the
// geocoder can't resolve (→ 404), or throws for transient failures (→ 500,
// which crawlers retry instead of de-indexing the page; a cached page stays).
const BASE = process.env.SELF_BASE ?? (process.env.VERCEL_ENV ? 'https://metablend.app' : 'http://localhost:3000') // SELF_BASE: a local next start on another port
// Same lower-cased key the app uses, so these self-fetches share its CDN copies
const cityQuery = slug => encodeURIComponent(slugToQuery(slug).toLowerCase())

async function getForecast(slug) {
  const res = await fetch(`${BASE}/api/forecast?city=${cityQuery(slug)}&lang=en`, { next: { revalidate: 900 } })
  return readForecast(res, !!findCity(slug))
}

// The outlook (7-day table, rain sentence, climate) is a bonus on this page:
// if it fails, the page still renders the current consensus.
async function getOutlook(slug) {
  try {
    // &lang=en like the forecast above: the same CDN copy the app's English visitors get
    const res = await fetch(`${BASE}/api/outlook?city=${cityQuery(slug)}&lang=en`, { next: { revalidate: 900 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.error ? null : atNow(json) // the copy can be 2.5 h old: its hours and headlines as of this render
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const { city } = await params
  const name = displayName(city)
  return {
    title: `${name} Weather: Consensus of Up to 20 Weather Sources`,
    description:
      `${name} weather blended from up to 20 sources at once: current temperature, rain probability, ` +
      `wind and a 7-day consensus forecast, weighted by measured accuracy.`,
    alternates: { canonical: `/weather/${city}` },
  }
}

export default async function CityWeather({ params }) {
  const { city } = await params
  const [data, outlook] = await Promise.all([getForecast(city), getOutlook(city)])
  if (data === 'unknown') notFound()
  const name = data.city ?? displayName(city)
  const upSources = (data.sources ?? []).filter(s => !s.down)
  // the three largest shares of this blend, as the blend counts them (lib/consensus.js): only sources that
  // answered, and not MetaBlend Local, which is made from the blend
  const topWeights = Object.entries(blendShares(data.sources, data.weights ?? {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, w]) => `${upSources.find(s => s.apiId === id)?.displayName ?? id} (${(w * 100).toFixed(1)}%)`)
  const others = CITIES.filter(c => c.slug !== city).slice(0, 12).map(({ slug, name }) => ({ slug, name }))
  const { temp, feelsLike, rainPct, windKmh, confidencePct } = data.consensus

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonForScript({
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
      {/* only what the page shows goes into its HTML, not the whole forecast */}
      <CityPage
        slug={city}
        name={name}
        country={data.country}
        consensus={{ temp, feelsLike, rainPct, windKmh, confidencePct }}
        condition={heroCondition(data)}
        sourceCount={upSources.length}
        topWeights={topWeights}
        others={others}
        outlook={outlook && {
          nowLocal: outlook.nowLocal,
          cc: outlook.cc,
          headlines: outlook.headlines,
          sun: outlook.sun,
          vsNormal: outlook.vsNormal,
          rainyDays: outlook.rainyDays,
          sources: outlook.sources?.map(s => s.name),
          days: outlook.days?.slice(0, 7).map(({ date, icon, condition, tempMax, tempMin, rainPct, windKmh }) => ({ date, icon, condition, tempMax, tempMin, rainPct, windKmh })),
        }}
      />
    </>
  )
}

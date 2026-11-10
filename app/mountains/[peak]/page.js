import { notFound } from 'next/navigation'
import featured from '@/lib/hike/featured.json'
import { hikeApiPath } from '@/lib/hike/params'
import { jsonForScript } from '@/lib/html'
import SummitPage from './SummitPage'

// Server-rendered summit weather for each featured peak: the summit window,
// a 7-day summit table and (in winter) the avalanche danger, in crawlable
// HTML — "Großglockner weather" lands here, the app has the rest. Rendered on
// demand and ISR-cached for 30 minutes, like the summit forecast itself.
export const revalidate = 1800

// On-demand caching: no pages are built ahead; each is rendered on its first
// visit and then served from the cache for `revalidate` seconds. Without
// this a dynamic route renders on every request and revalidate is ignored.
export async function generateStaticParams() { return [] }

// self-fetches go through the public domain (the raw deployment URL is behind
// deployment protection); SELF_BASE for a local `next start` on another port
const BASE = process.env.SELF_BASE ?? (process.env.VERCEL_ENV ? 'https://metablend.app' : 'http://localhost:3000')
const peakById = id => featured.find(p => p.id === id && p.kind !== 'hut') ?? null

async function getSummit(peak) {
  const res = await fetch(`${BASE}${hikeApiPath(peak)}`, { next: { revalidate: 1800 } })
  const body = res.ok ? await res.json() : null
  if (!res.ok || body.unavailable) throw new Error(`hike api ${res.ok ? 'unavailable' : res.status}`) // 500 → crawlers retry instead of dropping the page
  return body
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
    title: `${peak.name} Weather: Summit Forecast (${peak.elev} m)`,
    description:
      `${peak.name} summit weather at ${peak.elev} m: today's favourable summit window, wind up top, ` +
      `freezing level and thunderstorm risk for 7 days, blended from up to 9 weather models.`,
    alternates: { canonical: `/mountains/${peak.id}` },
  }
}

export default async function MountainWeather({ params }) {
  const peak = peakById((await params).peak)
  if (!peak) notFound()
  const [d, ava] = await Promise.all([getSummit(peak), getAvalanche(peak)])
  const nearby = featured
    .filter(p => p.region === peak.region && p.id !== peak.id && p.kind !== 'hut')
    .slice(0, 10)
    .map(({ id, name, elev }) => ({ id, name, elev }))

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
              { '@type': 'ListItem', position: 2, name: 'Mountains', item: 'https://metablend.app/mountains' },
              { '@type': 'ListItem', position: 3, name: `${peak.name} weather` },
            ],
          }),
        }}
      />
      {/* only what the page shows goes into its HTML, not the whole summit forecast */}
      <SummitPage
        peak={{ id: peak.id, name: peak.name, elev: peak.elev, region: peak.region, country: peak.country, grade: peak.grade }}
        days={d.days?.map(({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm }) => ({ date, icon, tempMin, tempMax, windMax, rainPct, freezingMin, freezingMax, storm }))}
        windows={d.windows ? { today: d.windows.today, tomorrow: d.windows.tomorrow } : null}
        todayLocal={d.nowLocal?.slice(0, 10)}
        tomorrowLocal={d.days?.[1]?.date}
        stormUnknown={!!d.notes?.includes('no_storm_data')}
        sources={d.sources?.map(s => s.name)}
        ava={ava ? { today: ava.today, tomorrow: ava.tomorrow } : null}
        nearby={nearby}
      />
    </>
  )
}

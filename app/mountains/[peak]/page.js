import { notFound } from 'next/navigation'
import featured from '@/lib/hike/featured.json'
import { hikeApiPath } from '@/lib/hike/params'
import { loadSummit } from '@/lib/hike/summit-fetch'
import { readAvalanche } from '@/lib/avalanche/read'
import { summitProps, storedPath, STORED_SECONDS } from '@/lib/hike/summit-props'
import { OM_MODELS, modelCovers } from '@/lib/outlook/models'
import { SOURCE_NAMES } from '@/lib/sources'
import { jsonForScript } from '@/lib/html'
import SummitPage from './SummitPage'

// Server-rendered summit weather for each featured peak: the summit window,
// a 7-day summit table in crawlable HTML, and (in winter) the avalanche danger,
// read by the browser — "Großglockner weather" lands here, the app has the rest. Rendered on
// demand and kept six hours, from a stored forecast of three models: the pages
// are asked mostly by crawlers, and each render used to cost a full summit
// forecast. The live one comes with the button on the page (SummitPage.jsx).
export const revalidate = 21600 // STORED_SECONDS; Next wants the number itself here

// On-demand caching: no pages are built ahead; each is rendered on its first
// visit and then served from the cache for `revalidate` seconds. Without
// this a dynamic route renders on every request and revalidate is ignored.
export async function generateStaticParams() { return [] }

// self-fetches go through the public domain (the raw deployment URL is behind
// deployment protection); SELF_BASE for a local `next start` on another port
const BASE = process.env.SELF_BASE ?? (process.env.VERCEL_ENV ? 'https://metablend.app' : 'http://localhost:3000')
const peakById = id => featured.find(p => p.id === id && p.kind !== 'hut') ?? null

const getSummit = peak => loadSummit(`${BASE}${storedPath(hikeApiPath(peak))}`)
// The avalanche danger is not kept with the page: the browser reads it when the page opens (SummitPage.jsx).
// The server asks only for how many days the area has a rating, so the section holds its place and nothing
// below it moves; kept as long as the page, so this request never shortens the page's time. A slow avalanche
// source does not hold up the page: after 3 s it is built without that room (the browser still reads the danger).
async function getAvalancheRows(peak) {
  const a = await readAvalanche(`${BASE}/api/avalanche?lat=${peak.lat.toFixed(2)}&lon=${peak.lon.toFixed(2)}`, { ms: 3000, init: { next: { revalidate: STORED_SECONDS } } })
  return [a?.today, a?.tomorrow].filter(Boolean).length
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
  const [d, avaRows] = await Promise.all([getSummit(peak), getAvalancheRows(peak)])
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
        peak={{ id: peak.id, name: peak.name, elev: peak.elev, lat: peak.lat, lon: peak.lon, region: peak.region, country: peak.country, grade: peak.grade }}
        {...summitProps(d)}
        fullList={OM_MODELS.filter(m => modelCovers(m.model, peak.lat, peak.lon)).map(m => SOURCE_NAMES[m.id] ?? m.id)}
        avaRows={avaRows}
        nearby={nearby}
      />
    </>
  )
}

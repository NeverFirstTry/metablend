import { t } from '@/lib/i18n'
import { fill } from '@/lib/outlook/text'
import { pickLang, pickUnit } from '@/lib/share'
import GoToCity from './GoToCity'

// Where shared links land: /city/Vienna?lang=de. Chat apps and feeds read the
// preview card from here; people are sent straight on to the forecast. Kept
// out of search results — it's a doorway, the forecast is the page.
const cityOf = raw => decodeURIComponent(raw ?? '').trim().slice(0, 80)

export async function generateMetadata({ params, searchParams }) {
  const [{ name }, sp] = await Promise.all([params, searchParams])
  const city = cityOf(name)
  const lang = pickLang(sp?.lang)
  const title = fill(t(lang, 'shareTitle'), { city })
  const description = t(lang, 'shareDesc')
  const image = `/api/og/city?${new URLSearchParams({ name: city, lang, unit: pickUnit(sp?.unit) })}`
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: '/' },
    openGraph: { title, description, type: 'website', url: `/city/${encodeURIComponent(city)}`, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function CityShare({ params }) {
  const { name } = await params
  return <GoToCity city={cityOf(name)} />
}

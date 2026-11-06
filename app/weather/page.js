import { CITIES } from '@/lib/cities'
import CityList from './CityList'

// Crawlable hub for the per-city pages. Any city works at /weather/<slug>;
// this lists the curated set that the sitemap advertises.
export const metadata = {
  title: 'City Weather — Consensus Forecasts for 50+ Cities',
  description:
    'Consensus forecasts for 54 cities worldwide, blended from up to 20 weather sources at once: ' +
    'current conditions, rain probability and 7-day outlook.',
  alternates: { canonical: '/weather' },
}

export default function CityIndex() {
  return <CityList cities={CITIES.map(({ slug, name }) => ({ slug, name }))} />
}

import HomePage from '../HomePage'
import LangPack from '../components/LangPack'
import { LANDING_LANGS, landingMetadata, exampleForecast } from '@/lib/landing'
import featured from '@/lib/hike/featured.json'

// The home page in one language, for search engines and links: /de, /fr ...
// Static like "/", refreshed at most hourly for the example. Any other path here is a 404.
export const revalidate = 3600
export const dynamicParams = false
export function generateStaticParams() { return LANDING_LANGS.map(lang => ({ lang })) }

export async function generateMetadata({ params }) {
  const { lang } = await params
  return landingMetadata(lang)
}

export default async function Page({ params }) {
  const { lang } = await params
  const example = await exampleForecast()
  return (
    <>
      {/* the root layout says English; before the first paint, for screen readers, hyphens and lib/useLang.js */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=document.documentElement.dataset.pageLang=${JSON.stringify(lang)}` }} />
      <LangPack lang={lang} />
      <HomePage pageLang={lang} example={example} peaks={featured.filter(p => p.kind !== 'hut').length} />
    </>
  )
}

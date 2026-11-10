// The website's landing page: its example forecast, and what search engines get
// for each language (/, /de, /fr, ...). "/" and the language pages are the forecast
// page's HTML; the boot script in lib/app-client.js picks the view before first paint.
import { LANGUAGES, t } from './i18n.js'
import { heroCondition } from './conditions.js'
import { readForecast } from './weather-page.js'

// the tag says what the text is written for: Brazilian Portuguese, Simplified Chinese
const HREFLANG = { pt: 'pt-BR', zh: 'zh-Hans' }
const OG_LOCALE = {
  de: 'de_DE', fr: 'fr_FR', es: 'es_ES', it: 'it_IT', nl: 'nl_NL', pl: 'pl_PL', cs: 'cs_CZ', sl: 'sl_SI', pt: 'pt_BR', ja: 'ja_JP', zh: 'zh_CN', ko: 'ko_KR',
}

export const LANDING_LANGS = LANGUAGES.map(l => l.code).filter(code => code !== 'en')
export const landingPath = lang => (lang === 'en' ? '/' : `/${lang}`)

export function landingAlternates(lang) {
  const languages = { 'x-default': '/' }
  for (const { code } of LANGUAGES) languages[HREFLANG[code] ?? code] = landingPath(code)
  return { canonical: landingPath(lang), languages }
}

export function landingMetadata(lang) {
  const title = `MetaBlend · ${t(lang, 'landingMetaTitle')}`
  const description = `${t(lang, 'homeLead')} ${t(lang, 'landingSecond')}`
  return {
    title: { absolute: title },
    description,
    alternates: landingAlternates(lang),
    openGraph: { title, description, url: landingPath(lang), siteName: 'MetaBlend', type: 'website', locale: OG_LOCALE[lang] },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// Only what the example shows goes into the page's HTML. The sentence is written
// in the browser, in the visitor's language and unit.
export function exampleFrom(json) {
  return {
    temp: json.consensus.temp,
    agree: json.consensus.confidencePct,
    condition: heroCondition(json),
    // blended sources without public readings come along as names, so the example counts them like the forecast page
    sources: (json.sources ?? []).filter(s => !s.down && !s.synthetic).map(({ apiId, displayName, temp, valuesHidden }) => (valuesHidden ? { apiId, displayName, valuesHidden } : { apiId, displayName, temp })),
  }
}

// Through the public domain and in English, like the city pages: it shares the
// CDN copy of Vienna, and the data cache shares one answer between all 13 pages.
const BASE = process.env.SELF_BASE ?? (process.env.VERCEL_ENV ? 'https://metablend.app' : 'http://localhost:3000')

// A failed refresh throws, so the page keeps its last good copy. In a build there
// is no last copy and a throw would stop the deploy: the page goes out without an
// example and fills it in at its next refresh.
export async function exampleForecast({ fetcher = fetch, building = process.env.NEXT_PHASE === 'phase-production-build' } = {}) {
  try {
    const res = await fetcher(`${BASE}/api/forecast?city=vienna&lang=en`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) })
    const forecast = await readForecast(res, true)
    // the chart, tiles and tabs: without them the page shows the forecast alone
    const outlook = await fetcher(`${BASE}/api/outlook?city=vienna&lang=en`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
    return { ...exampleFrom(forecast), forecast, outlook: outlook?.error ? null : outlook }
  } catch (e) {
    if (building) return null
    throw e
  }
}

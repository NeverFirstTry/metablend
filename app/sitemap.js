import { CITIES } from '@/lib/cities'
import featured from '@/lib/hike/featured.json'
import { LANDING_LANGS, landingAlternates } from '@/lib/landing'

const BASE = 'https://metablend.app'

export default function sitemap() {
  const now = new Date()
  // Search engines learn to distrust lastModified when everything always
  // claims "just now" — only genuinely live pages carry the current time.
  const legalUpdated = new Date('2026-07-07')
  const privacyUpdated = new Date('2026-11-05') // + controller, hosting, email contact, rights
  const termsUpdated = new Date('2026-11-05') // + disclaimer, all 13 languages
  // each language page names all the others (hreflang), here as in its own HTML
  const languages = Object.fromEntries(Object.entries(landingAlternates('en').languages).map(([tag, path]) => [tag, `${BASE}${path}`]))
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1, alternates: { languages } },
    ...LANDING_LANGS.map(lang => ({ url: `${BASE}/${lang}`, lastModified: now, changeFrequency: 'daily', priority: 0.9, alternates: { languages } })),
    { url: `${BASE}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/weather`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/planner`, lastModified: legalUpdated, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/heatmap`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: privacyUpdated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: termsUpdated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/impressum`, lastModified: termsUpdated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/support`, lastModified: new Date('2026-11-09'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/press`, lastModified: new Date('2026-11-11'), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/aviation`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/hike`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/mountains`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/testers`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    ...['loww', 'lowi', 'lows', 'eddm', 'eddf', 'egll', 'lfpg', 'eham', 'lirf', 'lszh', 'kjfk', 'klax', 'kord', 'rjtt', 'yssy', 'omdb'].map(icao => ({
      url: `${BASE}/aviation/${icao}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.6,
    })),
    ...featured.filter(p => p.kind !== 'hut').map(p => ({
      url: `${BASE}/mountains/${p.id}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.6,
    })),
    ...CITIES.map(c => ({
      url: `${BASE}/weather/${c.slug}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
    })),
  ]
}

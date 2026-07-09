import { CITIES } from '@/lib/cities'

const BASE = 'https://metablend.app'

export default function sitemap() {
  const now = new Date()
  // Search engines learn to distrust lastModified when everything always
  // claims "just now" — only genuinely live pages carry the current time.
  const legalUpdated = new Date('2026-07-07')
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/weather`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/planner`, lastModified: legalUpdated, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/heatmap`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: legalUpdated, changeFrequency: 'yearly', priority: 0.3 },
    ...CITIES.map(c => ({
      url: `${BASE}/weather/${c.slug}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
    })),
  ]
}

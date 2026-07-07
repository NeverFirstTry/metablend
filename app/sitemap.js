import { CITIES } from '@/lib/cities'

const BASE = 'https://metablend.app'

export default function sitemap() {
  const now = new Date()
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/weather`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/planner`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/heatmap`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...CITIES.map(c => ({
      url: `${BASE}/weather/${c.slug}`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
    })),
  ]
}

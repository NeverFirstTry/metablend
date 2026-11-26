// Curated cities for the server-rendered /weather/[city] SEO pages: the hub
// page links them all, the sitemap lists them, and each renders on demand
// with ISR (no build-time fetching — that would burn upstream API quota on
// every deploy). Any other city still works via /weather/<slug>; this list is
// just the crawlable, linked set.
//
// Slugs are ASCII/lowercase/dashes; the geocoder resolves the de-slugged name.

export const CITIES = [
  // Europe
  { slug: 'vienna', name: 'Vienna' },
  { slug: 'berlin', name: 'Berlin' },
  { slug: 'munich', name: 'Munich' },
  { slug: 'hamburg', name: 'Hamburg' },
  { slug: 'zurich', name: 'Zurich' },
  { slug: 'london', name: 'London' },
  { slug: 'paris', name: 'Paris' },
  { slug: 'madrid', name: 'Madrid' },
  { slug: 'barcelona', name: 'Barcelona' },
  { slug: 'rome', name: 'Rome' },
  { slug: 'milan', name: 'Milan' },
  { slug: 'amsterdam', name: 'Amsterdam' },
  { slug: 'brussels', name: 'Brussels' },
  { slug: 'copenhagen', name: 'Copenhagen' },
  { slug: 'stockholm', name: 'Stockholm' },
  { slug: 'oslo', name: 'Oslo' },
  { slug: 'helsinki', name: 'Helsinki' },
  { slug: 'dublin', name: 'Dublin' },
  { slug: 'lisbon', name: 'Lisbon' },
  { slug: 'prague', name: 'Prague' },
  { slug: 'warsaw', name: 'Warsaw' },
  { slug: 'budapest', name: 'Budapest' },
  { slug: 'athens', name: 'Athens' },
  { slug: 'istanbul', name: 'Istanbul' },
  // Americas
  { slug: 'new-york', name: 'New York' },
  { slug: 'los-angeles', name: 'Los Angeles' },
  { slug: 'chicago', name: 'Chicago' },
  { slug: 'houston', name: 'Houston' },
  { slug: 'miami', name: 'Miami' },
  { slug: 'toronto', name: 'Toronto' },
  { slug: 'vancouver', name: 'Vancouver' },
  { slug: 'mexico-city', name: 'Mexico City' },
  { slug: 'sao-paulo', name: 'São Paulo' },
  { slug: 'buenos-aires', name: 'Buenos Aires' },
  { slug: 'rio-de-janeiro', name: 'Rio de Janeiro' },
  // Asia & Middle East
  { slug: 'tokyo', name: 'Tokyo' },
  { slug: 'osaka', name: 'Osaka' },
  { slug: 'seoul', name: 'Seoul' },
  { slug: 'beijing', name: 'Beijing' },
  { slug: 'shanghai', name: 'Shanghai' },
  { slug: 'hong-kong', name: 'Hong Kong' },
  { slug: 'singapore', name: 'Singapore' },
  { slug: 'bangkok', name: 'Bangkok' },
  { slug: 'mumbai', name: 'Mumbai' },
  { slug: 'delhi', name: 'Delhi' },
  { slug: 'dubai', name: 'Dubai' },
  // Africa
  { slug: 'cairo', name: 'Cairo' },
  { slug: 'lagos', name: 'Lagos' },
  { slug: 'nairobi', name: 'Nairobi' },
  { slug: 'cape-town', name: 'Cape Town' },
  { slug: 'johannesburg', name: 'Johannesburg' },
  // Oceania
  { slug: 'sydney', name: 'Sydney' },
  { slug: 'melbourne', name: 'Melbourne' },
  { slug: 'auckland', name: 'Auckland' },
]

// "new-york" → "new york" for the geocoder; unknown slugs are still resolved.
export const slugToQuery = slug => decodeURIComponent(slug).replace(/-/g, ' ')

export const findCity = slug => CITIES.find(c => c.slug === slug)

// The one address of a city page, as text (not percent-encoded): lower case, words joined by single hyphens, none
// at either end. null for an address that cannot be read or has nothing left ("---"). Any other spelling of it
// (wien---, Wien, new--york, new%20york) moves there for good, so it is never a page of its own with the
// hyphens as spaces in the city's name (owner, 2026-11-26).
export function canonicalCitySlug(slug) {
  let s
  try { s = decodeURIComponent(slug) } catch { return null }
  return s.toLowerCase().replace(/[\s-]+/g, '-').replace(/^-|-$/g, '') || null
}

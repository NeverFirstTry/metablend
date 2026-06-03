import { supabase } from '@/lib/supabase'

const SITE = 'https://metablend-beta.vercel.app'

function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// RSS 2.0 feed of the last 24h of consensus snapshots for a city.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')

  if (!city) {
    return new Response('Missing ?city= parameter', { status: 400 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('consensus_history')
    .select('temp, rain_pct, wind_kmh, confidence_pct, condition, created_at')
    .ilike('city', city)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  const rows = error ? [] : (data ?? [])

  const items = rows.map(r => {
    const when = new Date(r.created_at)
    const title = `${r.temp}°C, ${r.condition ?? 'n/a'} — ${r.confidence_pct}% consensus`
    const desc = `Temperature ${r.temp}°C, rain ${r.rain_pct}%, wind ${r.wind_kmh} km/h, consensus confidence ${r.confidence_pct}%.`
    return `    <item>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(desc)}</description>
      <pubDate>${when.toUTCString()}</pubDate>
      <guid isPermaLink="false">${escapeXml(city)}-${when.getTime()}</guid>
      <link>${SITE}/?city=${encodeURIComponent(city)}</link>
    </item>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MetaBlend — ${escapeXml(city)}</title>
    <link>${SITE}/?city=${encodeURIComponent(city)}</link>
    <description>Weighted weather consensus for ${escapeXml(city)} over the last 24 hours.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  })
}

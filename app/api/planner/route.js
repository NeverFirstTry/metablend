import { geocodeCity } from '@/lib/weather'

// Per-month climate normals (avg temp + rainy days) from ~10 years of ERA5 data.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')
  if (!city) return Response.json({ error: 'No city specified' }, { status: 400 })

  const geo = await geocodeCity(city)
  if (!geo) return Response.json({ error: `"${city}" was not found.` }, { status: 404 })

  const endYear = new Date().getFullYear() - 1
  const startYear = endYear - 9
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${geo.lat}&longitude=${geo.lon}&start_date=${startYear}-01-01&end_date=${endYear}-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`

  const res = await fetch(url)
  if (!res.ok) return Response.json({ error: 'Historical data unavailable' }, { status: 502 })
  const day = (await res.json()).daily
  if (!day?.time) return Response.json({ error: 'No historical data' }, { status: 502 })

  // accumulate per calendar month
  const tSum = Array(12).fill(0), tN = Array(12).fill(0), rainy = Array(12).fill(0)
  const yearsPerMonth = Array.from({ length: 12 }, () => new Set())

  day.time.forEach((d, i) => {
    const m = parseInt(d.slice(5, 7)) - 1
    const year = d.slice(0, 4)
    yearsPerMonth[m].add(year)
    const t = day.temperature_2m_mean[i]
    const p = day.precipitation_sum[i]
    if (t != null) { tSum[m] += t; tN[m]++ }
    if (p != null && p >= 1) rainy[m]++
  })

  const months = Array.from({ length: 12 }, (_, m) => ({
    month: m + 1,
    avgTemp: tN[m] ? Math.round(tSum[m] / tN[m] * 10) / 10 : null,
    avgRainDays: yearsPerMonth[m].size ? Math.round(rainy[m] / yearsPerMonth[m].size) : null,
  }))

  return Response.json({ city: geo.name, country: geo.country, months })
}

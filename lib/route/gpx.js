// GPX → points (pure — unit tested): track points (<trkpt>) or, without a
// track, route points (<rtept>); segments and tracks joined in file order.
// A small regex reader on purpose: it runs in node tests and in the app alike.
const TAG = tag => new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g')
const attr = (s, k) => s.match(new RegExp(`\\b${k}\\s*=\\s*["']([^"']*)["']`))?.[1]
const text = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim()

function readPoints(xml, tag) {
  const out = []
  for (const m of xml.matchAll(TAG(tag))) {
    const lat = Number(attr(m[1], 'lat')), lon = Number(attr(m[1], 'lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    const e = m[2]?.match(/<ele>\s*([-+\d.eE]+)\s*<\/ele>/)?.[1]
    const ele = e == null ? null : Number(e)
    out.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null })
  }
  return out
}

export function parseGpx(xml) {
  if (typeof xml !== 'string' || !/<gpx\b/i.test(xml)) return null
  let points = readPoints(xml, 'trkpt')
  if (points.length < 2) points = readPoints(xml, 'rtept')
  if (points.length < 2) return null
  const raw = xml.match(/<(?:trk|rte)\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1]
    ?? xml.match(/<metadata\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1]
  const name = raw ? text(raw).slice(0, 80) : ''
  return { name: name || null, points }
}

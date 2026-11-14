// Which country a position lies in. THE RULE (owner, 2026-11-14): we follow OpenStreetMap's country
// boundaries. The outlines come from a published file made of OpenStreetMap's boundary relations
// (Overture Maps, divisions; scripts/places/boundaries.py), and a position is looked up in them here,
// point in polygon: no query service is asked. So Crimea is filed under Ukraine, Northern Cyprus under
// Cyprus, Abkhazia and South Ossetia under Georgia, Kashmir along the lines of control, Taiwan and
// Kosovo as themselves, because that is where OpenStreetMap draws the lines; it is no statement of ours
// on who administers or owns a place.
// The file gives some areas an outline and a code of its own (two letters beginning with X) and keeps
// them out of every country's outline. Decided by the owner, the same day:
//   - an area the file marks as disputed (the Golan, the southern Kurils, Senkaku, the pockets on the
//     China/India border, Bir Tawil, the no man's land at Latrun …): NO COUNTRY AND NO REGION, a summit
//     there shows its name and height only;
//   - West Bank and Gaza: PS; Sint Eustatius and Saba: BQ; Jan Mayen: SJ; Kosovo keeps XK;
//   - Western Sahara: EH, from the file's own outline of it (boundaries.py hands it over under that code).
// Of several outlines that hold a position the smallest wins: a territory before the state around it
// (Hong Kong before China, Western Sahara before Morocco). A position within a metre of an outline's
// line counts for that outline too, so a summit on a border line goes to the smaller of its countries
// (the Matterhorn and Piz Buin to Switzerland, the Hochvogel to Austria) whichever side the last
// decimal of its coordinates falls on.
// Pure.

export const LINE_M = 1
const BAND = 0.02 // degrees of latitude per bucket of edges
const PAD = 0.0002 // degrees, about 20 m: a position just outside an outline's box can still be on its line
const OWN = { XK: 'XK', XW: 'PS', XG: 'PS', XE: 'BQ', XS: 'BQ', XJ: 'SJ' }

// the country code an outline of the file stands for; null: an area the file marks as disputed
export const areaCode = cc => (/^X/.test(cc) ? OWN[cc] ?? null : cc)

// One outline (GeoJSON Polygon or MultiPolygon, [lon, lat]): its edges bucketed by latitude.
// holds(lon, lat): inside by the even-odd rule (holes and several parts come out right), or within
// LINE_M metres of an edge.
export function areaIndex(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let n = 0
  for (const p of polys) for (const r of p) n += Math.max(0, r.length - 1)
  const x1 = new Float64Array(n), y1 = new Float64Array(n), x2 = new Float64Array(n), y2 = new Float64Array(n)
  let e = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of polys) for (const r of p) for (let i = 0; i < r.length - 1; i++, e++) {
    x1[e] = r[i][0]; y1[e] = r[i][1]; x2[e] = r[i + 1][0]; y2[e] = r[i + 1][1]
    if (x1[e] < minX) minX = x1[e]
    if (x1[e] > maxX) maxX = x1[e]
    if (y1[e] < minY) minY = y1[e]
    if (y1[e] > maxY) maxY = y1[e]
  }
  const bands = n ? Math.floor((maxY - minY) / BAND) + 1 : 0
  const band = y => Math.min(bands - 1, Math.max(0, Math.floor((y - minY) / BAND)))
  const start = new Uint32Array(bands + 1)
  for (let i = 0; i < n; i++) for (let b = band(Math.min(y1[i], y2[i])); b <= band(Math.max(y1[i], y2[i])); b++) start[b + 1]++
  for (let b = 0; b < bands; b++) start[b + 1] += start[b]
  const list = new Uint32Array(start[bands] ?? 0), fill = start.slice(0, bands)
  for (let i = 0; i < n; i++) for (let b = band(Math.min(y1[i], y2[i])); b <= band(Math.max(y1[i], y2[i])); b++) list[fill[b]++] = i

  const inside = (lon, lat) => {
    if (lon < minX || lon > maxX || lat < minY || lat > maxY) return false
    const b = band(lat)
    let c = false
    for (let k = start[b]; k < start[b + 1]; k++) {
      const i = list[k]
      if ((y1[i] > lat) !== (y2[i] > lat) && lon < (x2[i] - x1[i]) * (lat - y1[i]) / (y2[i] - y1[i]) + x1[i]) c = !c
    }
    return c
  }
  const onLine = (lon, lat) => {
    const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540
    for (let b = Math.max(0, band(lat) - 1); b <= Math.min(bands - 1, band(lat) + 1); b++) for (let k = start[b]; k < start[b + 1]; k++) {
      const i = list[k], ax = (x1[i] - lon) * kx, ay = (y1[i] - lat) * ky, dx = (x2[i] - x1[i]) * kx, dy = (y2[i] - y1[i]) * ky
      const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0
      if (Math.hypot(ax + t * dx, ay + t * dy) <= LINE_M) return true
    }
    return false
  }
  return {
    edges: n,
    holds: (lon, lat) => n > 0 && lon >= minX - PAD && lon <= maxX + PAD && lat >= minY - PAD && lat <= maxY + PAD && (inside(lon, lat) || onLine(lon, lat)),
  }
}

// areas: [{ cc, area, geometry }] as boundaries.py writes them → (lon, lat) => { country, disputed, inArea }.
// country null with inArea: a disputed area. inArea false: no outline holds the position (the open sea,
// Antarctica's edge, a gap between two outlines).
export function countryLookup(areas) {
  const list = areas.map(a => ({ code: areaCode(a.cc), area: a.area, ix: areaIndex(a.geometry) })).sort((x, y) => x.area - y.area)
  return (lon, lat) => {
    for (const a of list) if (a.ix.holds(lon, lat)) return { country: a.code, disputed: a.code == null, inArea: true }
    return { country: null, disputed: false, inArea: false }
  }
}

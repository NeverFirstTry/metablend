// Rows for our summits and towns tables (supabase/places.sql) from the raw
// downloads (pure — unit tested): OpenStreetMap lines from
// scripts/places/osm_extract.py, GeoNames town lines (cities5000.txt).
import { parseEle } from '../hike/heights.js'
import { haversineKm } from '../geo.js'

const KIND = { 'natural=peak': 'peak', 'natural=volcano': 'peak', 'tourism=alpine_hut': 'hut', 'tourism=wilderness_hut': 'hut' }
const LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']

// A summit or hut with a name: its names in our languages (only where they
// differ from the name), its height, how notable OSM marks it (Wikipedia 2,
// Wikidata 1, summit cross 1 — as Nominatim's answers were scored). Null
// for anything else.
export function osmRow({ id, lat, lon, tags = {} }) {
  const name = tags.name?.trim()
  const kind = KIND[`natural=${tags.natural}`] ?? KIND[`tourism=${tags.tourism}`]
  if (!name || !kind || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const names = {}
  for (const l of LANGS) {
    const v = (tags[`name:${l}`] ?? (l === 'zh' ? tags['name:zh-Hans'] : null))?.trim()
    if (v && v !== name) names[l] = v
  }
  return {
    id: `osm-${id}`, kind, name, names: Object.keys(names).length ? names : null,
    ele: parseEle(tags.ele), notability: (tags.wikipedia ? 2 : 0) + (tags.wikidata ? 1 : 0) + (tags['summit:cross'] === 'yes' ? 1 : 0),
    wikidata: tags.wikidata ?? null, lat, lon,
  }
}

// A town's other names worth searching by: in the scripts our 13 languages
// are written in (Latin, Chinese, Japanese, Korean), no codes ("HAN"),
// numbers or links, each once, at most 30. Script extensions, not scripts:
// the long-vowel mark in "ウィーン" belongs to Katakana and Hiragana both.
const SCRIPTS = /^[\p{scx=Latin}\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}\p{M}\s'’.,()·・-]+$/u
export function cleanAltNames(list, name) {
  const seen = new Set([name.toLowerCase()])
  const out = []
  for (const raw of list) {
    const v = raw.trim()
    if (!v || /\d/.test(v) || /^[A-Z]{2,4}$/.test(v) || !SCRIPTS.test(v) || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
    if (out.length === 30) break
  }
  return out
}

// One line of GeoNames' cities5000.txt (tab-separated; admin1: "VN.44" →
// region name, from admin1CodesASCII.txt).
export function townRow(line, admin1) {
  const c = line.split('\t')
  const lat = Number(c[4]), lon = Number(c[5])
  if (c.length < 15 || !c[1] || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const alt = cleanAltNames(c[3] ? c[3].split(',') : [], c[1])
  return {
    id: Number(c[0]), name: c[1], country: c[8] || null, region: admin1[`${c[8]}.${c[10]}`] ?? null,
    population: Number(c[14]) || 0, lat, lon, alt: alt.length ? alt.join(' | ') : null,
  }
}

// Towns on a 1° grid: a summit's nearest town (for its country and region)
// from the cells around it, not from all towns.
export function townIndex(towns) {
  const grid = new Map()
  for (const t of towns) {
    const k = `${Math.floor(t.lat)},${Math.floor(t.lon)}`
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(t)
  }
  return grid
}

export function nearestTown(grid, lat, lon, maxRings = 4) {
  const la = Math.floor(lat), lo = Math.floor(lon)
  let best = null, bestKm = Infinity, foundAt = null
  for (let r = 0; r <= maxRings; r++) {
    if (foundAt != null && r > foundAt + 1) break // one ring more: the nearest can sit just across a cell edge
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue
        for (const t of grid.get(`${la + i},${(((lo + j + 180) % 360) + 360) % 360 - 180}`) ?? []) {
          const km = haversineKm(lat, lon, t.lat, t.lon)
          if (km < bestKm) { best = t; bestKm = km; foundAt ??= r }
        }
      }
    }
  }
  return best
}

// What goes in the table: every named hut; a named summit with a height —
// or without one when it has a Wikidata item (notable; the terrain model
// gives it a height where it's shown). Unnamed bumps never got this far.
export const keepSummit = r => r.kind === 'hut' || r.ele != null || !!r.wikidata

// A town's other names from GeoNames' alternateNamesV2 (each with its
// language): those in our 13 languages and in the country's own languages
// (Vietnamese "Hà Nội", German "Wien"), plus unlabelled spellings; no slang,
// old names, codes or links; preferred names first.
const OURS = new Set(LANGS)
export function townAltNames(entries, { name, countryLangs = [] }) {
  const kept = entries.filter(e => !e.colloquial && !e.historic && (OURS.has(e.lang) || countryLangs.includes(e.lang) || e.lang === ''))
  return cleanAltNames([...kept.filter(e => e.preferred), ...kept.filter(e => !e.preferred)].map(e => e.name), name)
}

// countryInfo.txt → { AT: ['de', 'hr'], … }: each country's first two languages.
export function countryLanguages(text) {
  const out = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const c = line.split('\t')
    if (c[0] && c.length > 15) out[c[0]] = c[15].split(',').map(l => l.split('-')[0].trim()).filter(Boolean).slice(0, 2)
  }
  return out
}

// What the summits dataset scripts (scripts/places) check before they touch
// the tables (pure — unit tested): a build needs every region, and a load
// that would delete much of a table stops — a broken extract or a short file
// must never empty production.

// Geofabrik's top-level regions: together, the world
export const REGIONS = ['australia-oceania', 'central-america', 'south-america', 'antarctica', 'africa', 'russia', 'asia', 'north-america', 'europe']

// the regions whose lines (data/places/osm/<region>.ndjson) aren't there
export const missingRegions = files => REGIONS.filter(r => !files.includes(`${r}.ndjson`))

// The country areas (scripts/places/countries.mjs → data/places/countries-summary.json): a build needs
// them asked to the end. Without them every summit would be filed by its nearest town again, which is
// what put Austrian peaks into Italy.
export const areasProblem = summary => (summary?.finished ? null : 'the country areas were not asked to the end: run scripts/places/countries.mjs (it picks up where it stopped)')

// The Overpass question for a few countries at once ([{ cc, relations: [id, …] }]): for each, a line that
// names it, then the ids of the peaks, volcanoes and huts (huts also as buildings) inside its area. An
// area is addressed by its number (3 600 000 000 + its boundary relation's), and several countries share
// a question because the public server takes half a minute to start on one, whatever it asks.
export const areasQuery = countries => `[out:json][timeout:900];${countries.map(c =>
  `(${c.relations.map(id => `area(${3600000000 + id});`).join('')})->.a;make country cc="${c.cc}";out;(node(area.a)[natural=peak];node(area.a)[natural=volcano];nw(area.a)[tourism=alpine_hut];nw(area.a)[tourism=wilderness_hut];);out ids;`).join('')}`

// …and its answer: { AT: ['N123', 'W45', …], … } with the ids as our rows carry them. null when it cannot
// be trusted: a "remark" is Overpass's word for a question that ran out of time or memory (its lists are
// cut short), and a server whose data is more than maxAgeDays old knows other summits than the extracts
// we read (one public mirror answered from data four months old, 2026-11-14).
export function areasAnswer(answer, { now = Date.now(), maxAgeDays = 7 } = {}) {
  if (!Array.isArray(answer?.elements) || answer.remark) return null
  const base = Date.parse(answer.osm3s?.timestamp_osm_base)
  if (!(now - base < maxAgeDays * 86400e3)) return null
  const out = {}
  let ids = null
  for (const e of answer.elements) {
    if (e.type === 'country') ids = out[e.tags.cc] = []
    else if (ids && (e.type === 'node' || e.type === 'way')) ids.push(`${e.type === 'node' ? 'N' : 'W'}${e.id}`)
  }
  return out
}

// The countries OpenStreetMap has a boundary for, from its list of relations tagged with a country code:
// [{ cc, relations }] sorted by code (a few territories carry their code on more than one relation).
export function countriesOf(answer) {
  if (!Array.isArray(answer?.elements) || answer.remark) return null
  const by = {}
  for (const e of answer.elements) if (/^[A-Z][A-Z]$/.test(e.tags?.['ISO3166-1'] ?? '')) (by[e.tags['ISO3166-1']] ??= []).push(e.id)
  return Object.keys(by).sort().map(cc => ({ cc, relations: by[cc].sort((a, b) => a - b) }))
}

// the ids we have that the new data no longer has
export const toDelete = (current, kept) => current.filter(id => !kept.has(id))

export function shrinkProblem({ table, current, deleting, allowShrink = false, max = 0.1 }) {
  if (allowShrink || deleting <= current * max) return null
  return `${table}: ${deleting} of ${current} rows would go — more than ${max * 100}%. Nothing deleted. If that's right, run again with --allow-shrink.`
}

// Whether a pass over a streamed extract (scripts/places/osm.mjs) read what it
// needed: the whole download (curl exit 0) — a cut-off one can end on a block
// boundary and look complete — or, for the second pass, up to the first way,
// where it stops the download itself.
export const streamComplete = (pass, curlCode, result) => curlCode === 0 || (pass === 'way-nodes' && result?.reached_ways === true)

// What the summits dataset scripts (scripts/places) check before they touch
// the tables (pure — unit tested): a build needs every region, and a load
// that would delete much of a table stops — a broken extract or a short file
// must never empty production.

// Geofabrik's top-level regions: together, the world
export const REGIONS = ['australia-oceania', 'central-america', 'south-america', 'antarctica', 'africa', 'russia', 'asia', 'north-america', 'europe']

// the regions whose lines (data/places/osm/<region>.ndjson) aren't there
export const missingRegions = files => REGIONS.filter(r => !files.includes(`${r}.ndjson`))

// A build needs the country outlines (scripts/places/boundaries.py): without them every summit would be
// filed by its nearest town again. summary: data/places/boundaries-summary.json. null: fine.
export function areasProblem(summary) {
  if (!summary?.release) return 'no country outlines yet: run scripts/places/boundaries.py (python, with duckdb)'
  if (!(summary.areas >= 200)) return `only ${summary.areas ?? 0} country outlines in release ${summary.release}: run scripts/places/boundaries.py again`
  if (!summary.westernSahara) return `the outline of Western Sahara is missing in release ${summary.release} (scripts/places/boundaries.py takes it from the file's region row)`
  if (summary.notFromOpenStreetMap?.length) return `release ${summary.release} has outlines that are not OpenStreetMap's (${summary.notFromOpenStreetMap.join(', ')}): we follow OpenStreetMap's boundaries, look at them first`
  return null
}
// how old the outlines are, in days (the release is named by its date: 2026-10-21.0)
export const outlinesAgeDays = (release, now = Date.now()) => Math.floor((now - Date.parse(String(release).slice(0, 10))) / 86400e3)

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

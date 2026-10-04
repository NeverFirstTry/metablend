// For the few places that build HTML strings by hand (Leaflet popups render
// their content as innerHTML). Anything that can carry user text goes through
// here — feedback city names are user input.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ENTITIES[c])
}

// JSON for an inline <script> (JSON-LD, inlined language packs): "<" as
// \u003c, so no value can close the tag. Still parses to the same data.
export function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// A name for a case-insensitive exact match (PostgREST ilike): %, _ and \
// escaped, so user input like "%" never turns into a wildcard pattern.
export function ilikeExact(s) {
  return String(s).replace(/[\\%_]/g, c => '\\' + c)
}

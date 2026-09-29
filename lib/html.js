// For the few places that build HTML strings by hand (Leaflet popups render
// their content as innerHTML). Anything that can carry user text goes through
// here — feedback city names are user input.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ENTITIES[c])
}

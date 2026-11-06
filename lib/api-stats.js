// What one forecast adds to each source's response time and answer counts. A source
// that was asked and had no answer (null, or it threw) is a failure; a source that
// doesn't cover this place, or has no key, wasn't asked (undefined) and counts for nothing.
export function statRows(timed) {
  return timed
    .filter(t => t.value !== undefined || t.down)
    .map(t => ({ api_id: t.id, ms: t.ms, up: t.value != null }))
}

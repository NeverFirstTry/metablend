// How long a blend may be served again (pure, unit tested): the full 15 minutes when every
// source that was asked answered, 2 minutes when one failed or Open-Meteo's shared model
// request came back empty, so a thin blend is not kept for long, in memory or on the CDN
// (Lienz showed 10 of 19 sources for a quarter of an hour, 2026-11-09). A source that does
// not apply to the place (no key, outside its area) answers undefined and counts as fine.
export const FULL_TTL = 15 * 60 * 1000
export const SHORT_TTL = 2 * 60 * 1000
// `timed`: the route's per-source results ({ value, down }); `models`: the shared model request's
export const blendTtl = (timed, models) => (timed.some(t => t.down || t.value === null) || models.value == null ? SHORT_TTL : FULL_TTL)

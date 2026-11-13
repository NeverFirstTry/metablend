// How long a blend may be served again (pure, unit tested): the full 15 minutes when every
// source that was asked answered, 2 minutes when one failed or Open-Meteo's shared model
// request came back empty, so a thin blend is not kept for long, in memory or on the CDN
// (Lienz showed 10 of 19 sources for a quarter of an hour, 2026-11-09). A source that does
// not apply to the place (no key, outside its area) answers undefined and counts as fine.
export const FULL_TTL = 15 * 60 * 1000
export const SHORT_TTL = 2 * 60 * 1000
// `failed`: the ids of the sources that were asked and gave nothing, and the global models missing from
// Open-Meteo's shared request (lib/weather.js missingModels), as the route builds it for partial and the
// log; `limited`: Open-Meteo's daily limit is reached (lib/open-meteo.js), so its sources stay away until
// midnight UTC and a refetch every 2 minutes would only hit the limit again
export const blendTtl = (failed, limited = false) => (!limited && failed.length ? SHORT_TTL : FULL_TTL)
// Everything the forecast gets from Open-Meteo, as it appears in `failed`: its own forecast, the four
// global models asked side by side, and the shared request of the national and AI models. All of them
// gone, each request asked twice (lib/weather.js tfetch), is the one thin blend the route does not send
// out while the place's last full blend is at most 2 hours old (lib/last-answer.js, kind forecast):
// 5 sources instead of 19 is a different forecast, a full one an hour old is not.
export const OPEN_METEO_IDS = ['open-meteo', 'ecmwf', 'gfs', 'icon', 'meteofrance', 'open-meteo-models']
export const lostOpenMeteo = failed => OPEN_METEO_IDS.every(id => failed.includes(id))
// the cached copy to serve again, or null: nothing cached, or past its own lifetime
export const freshCopy = (cached, now = Date.now()) => (cached && now - cached.ts < cached.ttl ? cached : null)

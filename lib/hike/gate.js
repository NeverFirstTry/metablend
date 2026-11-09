// A gate in front of a JSON getter: at most `max` requests in flight per instance, the rest wait their
// turn; callers asking for the same URL while it is in flight share that one request. Open-Meteo refuses
// bursts of parallel summit requests with 429 "Too many concurrent requests" (2026-11-09): the summit
// path sends everything through one gate (lib/hike/sources.js).
export function makeGate(get, max = 4) {
  const inflight = new Map()
  const waiting = []
  let running = 0
  const release = () => { running--; waiting.shift()?.() }
  return (url, opts) => {
    if (inflight.has(url)) return inflight.get(url)
    const p = new Promise(resolve => {
      const start = () => { running++; resolve(get(url, opts).finally(release)) }
      if (running < max) start(); else waiting.push(start)
    }).finally(() => inflight.delete(url))
    inflight.set(url, p)
    return p
  }
}

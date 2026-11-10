// A gate in front of a JSON getter: at most `max` requests in flight per instance, the rest wait their
// turn; callers asking for the same URL while it is in flight share that one request. Open-Meteo refuses
// bursts of parallel summit requests with 429 "Too many concurrent requests" (2026-11-09): the summit
// path sends everything through one gate (lib/hike/sources.js).
// With `maxWaitMs`, a request that has not had its turn by then gives up its place and fails with a
// GateWaitError: however many are asked at once, no caller is held longer than that for a turn.
export function makeGate(get, max = 4, maxWaitMs = 0) {
  const inflight = new Map()
  const waiting = []
  let running = 0
  const release = () => { running--; waiting.shift()?.() }
  return (url, opts) => {
    if (inflight.has(url)) return inflight.get(url)
    const p = new Promise((resolve, reject) => {
      let timer
      const start = () => { clearTimeout(timer); running++; resolve(get(url, opts).finally(release)) }
      if (running < max) return start()
      waiting.push(start)
      if (maxWaitMs) timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(start), 1)
        reject(Object.assign(new Error(`no turn at the gate within ${maxWaitMs} ms`), { name: 'GateWaitError' }))
      }, maxWaitMs)
    }).finally(() => inflight.delete(url))
    inflight.set(url, p)
    return p
  }
}

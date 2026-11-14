// In-memory, per-instance request throttle — best-effort (resets on cold
// start). CDN cache hits never reach a function, so it only ever counts the
// expensive cache misses.

// Whatever counts by visitor address forgets an address once its count is over: every such list is
// swept once a minute while this copy of the server runs, whichever address of the site is asked.
// (Before 2026-11-14 an expired entry stayed until its own list passed 1,000 entries or the copy was
// recycled.) The privacy notice says an address is counted "jeweils höchstens eine Stunde lang".
const sweeps = new Set()
let timer
export const sweepAll = (now = Date.now()) => { for (const sweep of sweeps) sweep(now) }
// sweep(now): drops what has expired from one list
export function forgetExpired(sweep) {
  sweeps.add(sweep)
  timer ??= setInterval(() => sweepAll(), 60_000)
  timer.unref?.() // never keeps a process alive
}

export function createRateLimiter({ max, windowMs }) {
  const hits = new Map()
  forgetExpired(now => { for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k) })
  return {
    limited(key, now = Date.now()) {
      const e = hits.get(key)
      if (!e || now > e.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return false
      }
      e.count += 1
      return e.count > max
    },
    get size() { return hits.size }, // how many keys it holds (the tests)
  }
}

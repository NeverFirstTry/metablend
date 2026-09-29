// In-memory, per-instance request throttle — best-effort (resets on cold
// start). CDN cache hits never reach a function, so it only ever counts the
// expensive cache misses.
export function createRateLimiter({ max, windowMs, sweepAt = 1000 }) {
  const hits = new Map()
  return {
    limited(key, now = Date.now()) {
      const e = hits.get(key)
      if (!e || now > e.resetAt) {
        // occasionally sweep expired keys so the map doesn't grow unbounded
        if (hits.size > sweepAt) {
          for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
        }
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return false
      }
      e.count += 1
      return e.count > max
    },
  }
}

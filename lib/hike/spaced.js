// Calls that go out at least gapMs apart, in the order they were made. A slow
// answer doesn't hold up the next call's slot. Nominatim's own fallback
// (lib/hike/nominatim.js) while its global gate isn't set up — one instance
// only. Pure apart from the clock — unit tested.
export function spaced(gapMs, { now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let last = -Infinity
  let chain = Promise.resolve()
  return fn => {
    const slot = chain.then(async () => {
      const wait = last + gapMs - now()
      if (wait > 0) await sleep(wait)
      last = now()
    })
    chain = slot.catch(() => {})
    return slot.then(fn)
  }
}

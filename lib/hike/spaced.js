// Calls that go out at least gapMs apart, in the order they were made — for
// Nominatim's usage policy (at most one request a second; here per warm
// instance, and every answer is CDN-cached). A slow answer doesn't hold up
// the next call's slot. Pure apart from the clock — unit tested.
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

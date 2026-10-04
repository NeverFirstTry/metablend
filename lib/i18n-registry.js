// Which language packs are in memory, and loading the rest on demand (pure —
// unit tested). `base` is there from the start (English); `loaders` fetch one
// language each (dynamic imports, so each is its own small file in the
// browser); `inlined()` returns packs a server-rendered page put in its HTML.
export function createRegistry(base, loaders, inlined = () => globalThis.__mbPacks) {
  const packs = { ...base }
  const pending = new Map()
  const pack = code => packs[code] ?? inlined()?.[code]
  const has = code => !!pack(code)
  // resolves true once the language is here, false if unknown or it failed (retryable)
  const load = code => {
    if (has(code)) return Promise.resolve(true)
    if (!loaders[code]) return Promise.resolve(false)
    if (!pending.has(code)) {
      pending.set(code, loaders[code]().then(
        m => { packs[code] = m.default; pending.delete(code); return true },
        () => { pending.delete(code); return false },
      ))
    }
    return pending.get(code)
  }
  const settled = () => Promise.allSettled([...pending.values()])
  const loadAll = () => Promise.all(Object.keys(loaders).map(load))
  return { pack, has, load, settled, loadAll }
}

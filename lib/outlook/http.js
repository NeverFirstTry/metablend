const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// JSON GET that never throws: null on timeout, non-2xx or bad JSON — a
// missing source drops out of the blend instead of taking the outlook down.
export async function getJson(url, { headers, ms = 10000, ...init } = {}) {
  try {
    const res = await fetch(url, { ...init, headers: { ...UA, ...headers }, signal: AbortSignal.timeout(ms) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

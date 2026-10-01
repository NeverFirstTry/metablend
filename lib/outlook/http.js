const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// The last request an upstream refused or dropped (host, status, its reason
// text), per warm instance — so a 502 can say *why* instead of nothing.
let lastFailure = null
export const lastUpstreamFailure = () => lastFailure

const hostOf = url => { try { return new URL(url).host } catch { return '' } }

// JSON GET that never throws: null on timeout, non-2xx or bad JSON — a
// missing source drops out of the blend instead of taking the outlook down.
export async function getJson(url, { headers, ms = 10000, ...init } = {}) {
  try {
    const res = await fetch(url, { ...init, headers: { ...UA, ...headers }, signal: AbortSignal.timeout(ms) })
    if (res.ok) return await res.json()
    const reason = (await res.text().catch(() => '')).slice(0, 200)
    lastFailure = { host: hostOf(url), status: res.status, reason, at: new Date().toISOString() }
    return null
  } catch (e) {
    lastFailure = { host: hostOf(url), status: 0, reason: e?.name ?? 'Error', at: new Date().toISOString() }
    return null
  }
}

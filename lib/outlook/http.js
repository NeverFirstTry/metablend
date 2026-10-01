const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// The last request an upstream refused or dropped (host, status, its reason
// text), per warm instance — so a 502 can say *why* instead of nothing.
let lastFailure = null
export const lastUpstreamFailure = () => lastFailure

const hostOf = url => { try { return new URL(url).host } catch { return '' } }

// JSON GET that never throws: null on timeout, non-2xx or bad JSON — a
// missing source drops out of the blend instead of taking the outlook down.
// `retries`: another try after a timeout or a 5xx (Open-Meteo answers
// Vercel in well under a second, but now and then a request hangs past the
// timeout); a 4xx is final.
export async function getJson(url, { headers, ms = 10000, retries = 0, ...init } = {}) {
  for (let attempt = 0; ; attempt++) {
    let status = 0
    try {
      const res = await fetch(url, { ...init, headers: { ...UA, ...headers }, signal: AbortSignal.timeout(ms) })
      if (res.ok) return await res.json()
      status = res.status
      const reason = (await res.text().catch(() => '')).slice(0, 200)
      lastFailure = { host: hostOf(url), status, reason, at: new Date().toISOString() }
    } catch (e) {
      lastFailure = { host: hostOf(url), status: 0, reason: e?.name ?? 'Error', at: new Date().toISOString() }
    }
    if (attempt >= retries || (status >= 400 && status < 500)) return null
  }
}

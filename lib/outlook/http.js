import { noteAnswer, isOpenMeteo, gatedFetch } from '../open-meteo.js'

const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// The last request an upstream refused or dropped (host, status, its reason
// text), per warm instance — so a 502 can say *why* instead of nothing.
let lastFailure = null
export const lastUpstreamFailure = () => lastFailure

const hostOf = url => { try { return new URL(url).host } catch { return '' } }

// JSON GET that never throws: null on timeout, non-2xx or bad JSON — a
// missing source drops out of the blend instead of taking the outlook down.
// `retries`: another try after a timeout, a 5xx or a 429 (Open-Meteo answers
// Vercel in well under a second, but now and then a request hangs past the
// timeout, and under load it refuses with "Too many concurrent requests",
// which clears a moment later: the retry waits Retry-After, else 300 ms, at
// most 2 s); any other 4xx is final.
export async function getJson(url, { headers, ms = 10000, retries = 0, ...init } = {}) {
  for (let attempt = 0; ; attempt++) {
    let status = 0, pause = 0
    try {
      // Open-Meteo through its gate (lib/open-meteo.js), every other host directly
      const res = await (isOpenMeteo(url) ? gatedFetch : fetch)(url, { ...init, headers: { ...UA, ...headers }, signal: AbortSignal.timeout(ms) })
      if (res.ok) return await res.json()
      status = res.status
      const reason = (await res.text().catch(() => '')).slice(0, 200)
      lastFailure = { host: hostOf(url), status, reason, at: new Date().toISOString() }
      noteAnswer(url, status, reason) // Open-Meteo's daily limit, if that is what it said
      if (status === 429) pause = Math.min(2000, (Number(res.headers.get('retry-after')) || 0.3) * 1000)
    } catch (e) {
      lastFailure = { host: hostOf(url), status: 0, reason: e?.name ?? 'Error', at: new Date().toISOString() }
    }
    if (attempt >= retries || (status >= 400 && status < 500 && status !== 429)) return null
    if (pause) await new Promise(r => setTimeout(r, pause))
  }
}

// iOS pushes straight to APNs over HTTP/2 with the ES256 provider token
// (reused for 50 min; Apple wants it renewed within the hour). Builds from
// Xcode register with the sandbox, App Store builds with production: an
// unknown device tries production first and falls back once.
import { connect } from 'node:http2'
import { signJwt } from './jwt.js'

const HOST = { prod: 'api.push.apple.com', sandbox: 'api.sandbox.push.apple.com' }

export function http2Request({ host, path, headers, body, timeoutMs = 10000 }) {
  return new Promise((resolve, reject) => {
    const client = connect(`https://${host}`)
    client.on('error', reject)
    const req = client.request({ ':method': 'POST', ':path': path, ...headers })
    req.setTimeout(timeoutMs, () => { req.close(); client.close(); reject(new Error('APNs timeout')) })
    let status = 0, data = ''
    req.setEncoding('utf8')
    req.on('response', h => { status = h[':status'] })
    req.on('data', c => { data += c })
    req.on('end', () => { client.close(); resolve({ status, body: data }) })
    req.on('error', e => { client.close(); reject(e) })
    req.end(body)
  })
}

const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('APNs timeout')), ms)
  p.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
})

export function createApns({ keyPem, keyId, teamId, topic = 'app.metablend', request = http2Request, now = () => Date.now(), timeoutMs = 10000 }) {
  let cached = null
  const token = () => {
    if (cached && now() - cached.at < 50 * 60e3) return cached.jwt
    cached = { at: now(), jwt: signJwt('ES256', { alg: 'ES256', kid: keyId }, { iss: teamId, iat: Math.floor(now() / 1000) }, keyPem) }
    return cached.jwt
  }
  async function attempt(env, { token: device, title, body, url, collapse }) {
    const res = await withTimeout(request({
      host: HOST[env], path: `/3/device/${device}`, timeoutMs,
      headers: { authorization: `bearer ${token()}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10', ...(collapse ? { 'apns-collapse-id': collapse } : {}) },
      body: JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, url: url ?? '/' }),
    }), timeoutMs)
    let reason = ''
    try { reason = JSON.parse(res.body || '{}').reason ?? '' } catch { /* empty body on success */ }
    return { status: res.status, reason }
  }
  return {
    async send(m) {
      try {
        const first = m.env === 'sandbox' ? 'sandbox' : 'prod'
        let r = await attempt(first, m)
        if (r.status === 200) return { ok: true, env: first }
        if (r.status === 400 && r.reason === 'BadDeviceToken' && !m.env) {
          r = await attempt('sandbox', m)
          if (r.status === 200) return { ok: true, env: 'sandbox' }
        } else if (r.status === 403 && r.reason === 'BadEnvironmentKeyInToken') {
          // a key created for one environment only (Sandbox or Production):
          // the other server is the only one it can reach
          const other = first === 'prod' ? 'sandbox' : 'prod'
          r = await attempt(other, m)
          if (r.status === 200) return { ok: true, env: other }
        }
        const gone = r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered'
        return { ok: false, gone, error: `APNs ${r.status} ${r.reason}`.trim() }
      } catch (e) {
        return { ok: false, gone: false, error: e.message }
      }
    },
  }
}

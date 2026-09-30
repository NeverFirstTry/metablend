// Android pushes via FCM HTTP v1. The OAuth access token comes from a
// self-signed service-account JWT and is reused until 5 min before it expires.
import { signJwt } from './jwt.js'

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

export function createFcm({ serviceAccount, fetchImpl = fetch, now = () => Date.now() }) {
  const sa = serviceAccount
  let cached = null
  async function accessToken() {
    if (cached && cached.exp - 300e3 > now()) return cached.token
    const iat = Math.floor(now() / 1000)
    const assertion = signJwt('RS256', { alg: 'RS256', typ: 'JWT' }, { iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat, exp: iat + 3600 }, sa.private_key)
    const r = await fetchImpl(sa.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    })
    const j = await r.json()
    if (!r.ok || !j.access_token) throw new Error(`FCM auth failed (${r.status})`)
    cached = { token: j.access_token, exp: now() + (j.expires_in ?? 3600) * 1000 }
    return cached.token
  }
  return {
    async send({ token, title, body, url, channel = 'alerts', collapse }) {
      try {
        const r = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: {
            token, notification: { title, body }, data: { url: url ?? '/' },
            android: { priority: channel === 'alerts' ? 'high' : 'normal', ...(collapse ? { collapse_key: collapse } : {}), notification: { channel_id: channel } },
          } }),
        })
        if (r.ok) return { ok: true }
        const j = await r.json().catch(() => ({}))
        const codes = (j.error?.details ?? []).map(d => d.errorCode)
        const gone = r.status === 404 || codes.includes('UNREGISTERED') || (r.status === 400 && /registration token/i.test(j.error?.message ?? ''))
        return { ok: false, gone, error: `FCM ${r.status} ${codes.join(',') || j.error?.status || ''}`.trim() }
      } catch (e) {
        return { ok: false, gone: false, error: e.message }
      }
    },
  }
}

// One entry point for the dispatcher and the test route: route a message to
// FCM or APNs by the device's platform; Android gets the channel by kind so
// people can mute alerts, briefings or hikes separately.
import { createFcm } from './fcm.js'
import { createApns } from './apns.js'
import { normalizePem, readableKey } from './pem.js'

const channelFor = kind => (kind === 'briefing' ? 'briefing' : kind?.startsWith('hike') || kind === 'test' ? 'hikes' : 'alerts')

export function createSender({ fcm, apns, fcmProblem = null, apnsProblem = null }) {
  return {
    async send(device, { title, body, url, kind }) {
      if (device.platform === 'android') {
        if (!fcm) return { ok: false, error: `FCM not configured${fcmProblem ? `: ${fcmProblem}` : ''}` }
        return fcm.send({ token: device.token, title, body, url, channel: channelFor(kind), collapse: kind })
      }
      if (!apns) return { ok: false, error: `APNs not configured${apnsProblem ? `: ${apnsProblem}` : ''}` }
      return apns.send({ token: device.token, env: device.apns_env ?? null, title, body, url, collapse: kind })
    },
  }
}

// The Firebase service account: the whole JSON in FIREBASE_SERVICE_ACCOUNT, or
// — easier in Vercel's .env-style form — three values copied out of it:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY. The key
// may arrive quoted and with literal "\n" (copied from the JSON) or with real
// line breaks (a .env import expands them); both become a proper PEM.
const unquote = v => String(v ?? '').trim().replace(/^"([\s\S]*)"$/, '$1')
export function serviceAccountFromEnv(env = process.env) {
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
      return { ...sa, private_key: normalizePem(sa.private_key) ?? sa.private_key }
    } catch { return null }
  }
  const project_id = unquote(env.FIREBASE_PROJECT_ID), client_email = unquote(env.FIREBASE_CLIENT_EMAIL)
  const private_key = normalizePem(unquote(env.FIREBASE_PRIVATE_KEY)) // whatever the paste did to the layout
  if (!project_id || !client_email || !private_key) return null
  return { project_id, client_email, private_key, token_uri: 'https://oauth2.googleapis.com/token' }
}

// Why FCM isn't configured, naming the variable but never its content (the
// values are write-only in Vercel, so this is the only way to tell).
export function firebaseProblem(env = process.env) {
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
      return sa?.project_id && sa?.client_email && sa?.private_key ? null : 'FIREBASE_SERVICE_ACCOUNT lacks project_id, client_email or private_key'
    } catch { return 'FIREBASE_SERVICE_ACCOUNT is not valid JSON' }
  }
  if (!unquote(env.FIREBASE_PROJECT_ID)) return 'FIREBASE_PROJECT_ID is missing or empty'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(unquote(env.FIREBASE_CLIENT_EMAIL))) return 'FIREBASE_CLIENT_EMAIL is missing or not an e-mail address (the "client_email" value)'
  const key = unquote(env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n')
  if (!key) return 'FIREBASE_PRIVATE_KEY is missing or empty'
  if (!/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(key)) return 'FIREBASE_PRIVATE_KEY must be the whole "private_key" value, from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----'
  if (!readableKey(normalizePem(key))) return 'FIREBASE_PRIVATE_KEY can\'t be read as a key — copy the whole "private_key" value again'
  return null
}

// The same for Apple: the .p8 contents and the two 10-character ids.
export function apnsProblem(env = process.env) {
  const key = normalizePem(unquote(env.APNS_KEY))
  if (!key) return 'APNS_KEY is missing or lacks -----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY----- (paste the whole .p8 file)'
  if (!readableKey(key)) return 'APNS_KEY can\'t be read as a key — paste the whole .p8 file again'
  if (!/^[A-Z0-9]{10}$/.test(unquote(env.APNS_KEY_ID))) return 'APNS_KEY_ID must be the 10-character Key ID shown next to the key'
  if (!/^[A-Z0-9]{10}$/.test(unquote(env.APNS_TEAM_ID))) return 'APNS_TEAM_ID must be the 10-character Team ID (Membership details)'
  return null
}

// Vercel env holds the secrets (the owner sets them); a .p8 pasted into one
// line keeps literal "\n" — turn those back into line breaks. One sender per
// configuration for the life of the instance: the FCM OAuth token and the APNs
// provider JWT get reused (Apple refuses tokens renewed more often than every
// 20 minutes).
let memo = null
export function senderFromEnv(env = process.env) {
  const key = [env.FIREBASE_SERVICE_ACCOUNT, env.FIREBASE_PROJECT_ID, env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY, env.APNS_KEY, env.APNS_KEY_ID, env.APNS_TEAM_ID].join('\u0000')
  if (memo?.key === key) return memo.sender
  let fcm = null, apns = null
  const serviceAccount = serviceAccountFromEnv(env)
  if (serviceAccount && readableKey(serviceAccount.private_key)) fcm = createFcm({ serviceAccount })
  const apnsIssue = apnsProblem(env)
  if (!apnsIssue) apns = createApns({ keyPem: normalizePem(unquote(env.APNS_KEY)), keyId: unquote(env.APNS_KEY_ID), teamId: unquote(env.APNS_TEAM_ID) })
  memo = { key, sender: createSender({ fcm, apns, fcmProblem: fcm ? null : firebaseProblem(env), apnsProblem: apnsIssue }) }
  return memo.sender
}

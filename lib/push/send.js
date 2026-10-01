// One entry point for the dispatcher and the test route: route a message to
// FCM or APNs by the device's platform; Android gets the channel by kind so
// people can mute alerts, briefings or hikes separately.
import { createFcm } from './fcm.js'
import { createApns } from './apns.js'

const channelFor = kind => (kind === 'briefing' ? 'briefing' : kind?.startsWith('hike') || kind === 'test' ? 'hikes' : 'alerts')

export function createSender({ fcm, apns }) {
  return {
    async send(device, { title, body, url, kind }) {
      if (device.platform === 'android') {
        if (!fcm) return { ok: false, error: 'FCM not configured' }
        return fcm.send({ token: device.token, title, body, url, channel: channelFor(kind), collapse: kind })
      }
      if (!apns) return { ok: false, error: 'APNs not configured' }
      return apns.send({ token: device.token, env: device.apns_env ?? null, title, body, url, collapse: kind })
    },
  }
}

// Vercel env holds the secrets (the owner sets them); a .p8 pasted into one
// line keeps literal "\n" — turn those back into line breaks. One sender per
// configuration for the life of the instance: the FCM OAuth token and the APNs
// provider JWT get reused (Apple refuses tokens renewed more often than every
// 20 minutes).
let memo = null
export function senderFromEnv(env = process.env) {
  const key = [env.FIREBASE_SERVICE_ACCOUNT, env.APNS_KEY, env.APNS_KEY_ID, env.APNS_TEAM_ID].join('\u0000')
  if (memo?.key === key) return memo.sender
  let fcm = null, apns = null
  try { if (env.FIREBASE_SERVICE_ACCOUNT) fcm = createFcm({ serviceAccount: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) }) } catch { fcm = null }
  if (env.APNS_KEY && env.APNS_KEY_ID && env.APNS_TEAM_ID) {
    apns = createApns({ keyPem: env.APNS_KEY.replace(/\\n/g, '\n'), keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID })
  }
  memo = { key, sender: createSender({ fcm, apns }) }
  return memo.sender
}

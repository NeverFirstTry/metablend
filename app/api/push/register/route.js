import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { hashDeviceKey, parseRegister } from '@/lib/push/validate'
import { authDevice, deleteDevice, registerDevice } from '@/lib/push/store'

// Called at every app start with the current push token.
const limiter = createRateLimiter({ max: 20, windowMs: 60e3 })

export const POST = withErrorLog('push.register', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const keyHash = hashDeviceKey(request.headers.get('x-device-key'))
  if (!keyHash) return Response.json({ error: 'Missing device key' }, { status: 401 })
  const parsed = parseRegister(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  return Response.json({ settings: await registerDevice(keyHash, parsed.value) })
})

// Notifications turned off on the phone (lib/push-client.js forgetWhenOff): its record goes now, not after 90
// days unseen: token, home city and settings, and with them its planned hikes and send log (on delete cascade).
export const DELETE = withErrorLog('push.register', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const device = await authDevice(request)
  if (!device) return Response.json({ deleted: false }) // nothing stored for this phone
  const { error } = await deleteDevice(device.id)
  if (error) throw new Error(`push device delete: ${error.message}`)
  return Response.json({ deleted: true })
})

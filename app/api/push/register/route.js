import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { hashDeviceKey, parseRegister } from '@/lib/push/validate'
import { authDevice, deleteDevice, registerDevice } from '@/lib/push/store'
import { addressGroup } from '@/lib/last-answer'

// Called at every app start with the current push token.
const limiter = createRateLimiter({ max: 20, windowMs: 60e3 })
// New phones one address may register in an hour (per server copy, in memory, like every count by address;
// an IPv6 line counts as one). A phone already known registers again at every start and is not counted.
// Ten leaves room for a household or a hut's Wi-Fi; a flood of made-up phones needs many addresses.
const newPhones = createRateLimiter({ max: 10, windowMs: 3600e3 })

export const POST = withErrorLog('push.register', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const keyHash = hashDeviceKey(request.headers.get('x-device-key'))
  if (!keyHash) return Response.json({ error: 'Missing device key' }, { status: 401 })
  const parsed = parseRegister(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  if (!(await authDevice(request)) && newPhones.limited(addressGroup(clientIp(request)))) {
    return Response.json({ error: 'Too many new phones from this network in an hour. Please try again later.' }, { status: 429 })
  }
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

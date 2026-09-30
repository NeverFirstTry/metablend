import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { hashDeviceKey, parseRegister } from '@/lib/push/validate'
import { registerDevice } from '@/lib/push/store'

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

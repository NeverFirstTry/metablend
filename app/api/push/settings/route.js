import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { parseSettings } from '@/lib/push/validate'
import { authDevice, updateSettings, listPlans, SETTINGS_COLS } from '@/lib/push/store'

const limiter = createRateLimiter({ max: 60, windowMs: 60e3 })
const pick = d => Object.fromEntries(SETTINGS_COLS.split(', ').filter(k => k !== 'id').map(k => [k, d[k]]))

export const GET = withErrorLog('push.settings', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ registered: false }, { status: 404 })
  return Response.json({ registered: true, settings: pick(device), plans: await listPlans(device.id) })
})

export const PUT = withErrorLog('push.settings', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  const parsed = parseSettings(await request.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  return Response.json({ settings: pick(await updateSettings(device.id, parsed.value)) })
})

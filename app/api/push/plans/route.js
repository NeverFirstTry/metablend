import { withErrorLog } from '@/lib/log'
import { clientIp } from '@/lib/auth'
import { createRateLimiter } from '@/lib/ratelimit'
import { parsePlan } from '@/lib/push/validate'
import { authDevice, addPlan, deletePlan, listPlans } from '@/lib/push/store'

const limiter = createRateLimiter({ max: 30, windowMs: 60e3 })

export const GET = withErrorLog('push.plans', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  return Response.json({ plans: await listPlans(device.id) })
})

export const POST = withErrorLog('push.plans', async (request) => {
  if (limiter.limited(clientIp(request))) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  const parsed = parsePlan(await request.json().catch(() => null), new Date().toISOString().slice(0, 10))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status })
  const r = await addPlan(device.id, parsed.value)
  if (r.error) return Response.json({ error: r.error }, { status: 409 })
  return Response.json({ plan: r.plan })
})

export const DELETE = withErrorLog('push.plans', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: 'Invalid id' }, { status: 400 })
  await deletePlan(device.id, id)
  return Response.json({ ok: true })
})

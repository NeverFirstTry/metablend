import { withErrorLog } from '@/lib/log'
import { authDevice, logSent, deleteDevice } from '@/lib/push/store'
import { pushText } from '@/lib/push/text'
import { senderFromEnv } from '@/lib/push/send'

// "Send a test notification" in More — once a minute per phone.
const last = new Map()

export const POST = withErrorLog('push.test', async (request) => {
  const device = await authDevice(request)
  if (!device) return Response.json({ error: 'Unknown device' }, { status: 404 })
  if (Date.now() - (last.get(device.id) ?? 0) < 60e3) return Response.json({ error: 'Wait a minute between tests' }, { status: 429 })
  last.set(device.id, Date.now())
  const r = await senderFromEnv().send(device, { ...pushText(device.lang, device.unit, { kind: 'test', vars: {} }), url: '/more', kind: 'test' })
  if (r.gone) { await deleteDevice(device.id); return Response.json({ error: 'This phone is no longer registered' }, { status: 410 }) }
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 })
  await logSent(device.id, 'test', 'test')
  return Response.json({ ok: true })
})

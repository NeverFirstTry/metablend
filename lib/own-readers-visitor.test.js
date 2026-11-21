// The widget feed asks our own forecast, outlook and rain addresses for a visitor. Each of those requests
// carries the server's key and that visitor's address, so the counts by address (stored forecasts, new
// places, kept answers) fall on the visitor and not on one count shared by everyone (security review of
// 2026-11-20). The route is called for real; the requests it sends are looked at.
import './test-jsx-hooks.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reset } from './test-route-fakes.js'

const sent = []
const inner = globalThis.fetch
globalThis.fetch = (input, init = {}) => {
  const h = new Headers(init.headers ?? {})
  sent.push({ url: String(input?.url ?? input), key: h.get('x-calibrate-key'), visitor: h.get('x-visitor') })
  return inner(input, init)
}
const { GET: widget } = await import('../app/api/app-widget/route.js')

test('the widget feed\'s own requests carry the key and the address of the visitor who asked', async () => {
  reset(); sent.length = 0
  await widget(new Request('https://metablend.app/api/app-widget?city=Lienz&lang=de&unit=C', { headers: { 'x-forwarded-for': '203.0.113.77' } }))
  const own = sent.filter(s => /\/api\/(forecast|outlook)\?/.test(s.url))
  assert.equal(own.length, 2, 'the forecast and the outlook')
  for (const s of own) assert.deepEqual([s.key, s.visitor], ['calibrate-secret', '203.0.113.77'], s.url)
})

test('the share card sends the same two headers (it cannot be rendered here; its source is read)', async () => {
  const { readFileSync } = await import('node:fs')
  // source-match-ok: next/og's image renderer does not load under node --test
  assert.match(readFileSync(new URL('../app/api/og/city/route.js', import.meta.url), 'utf8'), /headers: ownHeaders\(req\)/)
})

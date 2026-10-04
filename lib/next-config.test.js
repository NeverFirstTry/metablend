import { test } from 'node:test'
import assert from 'node:assert/strict'
import config from '../next.config.mjs'

// Next matches `source` with path-to-regexp; these sources are plain regex groups.
const matches = (source, path) => new RegExp(`^${source}$`).test(path)

test('next.config — no site may frame MetaBlend\'s pages, except the embeddable /widget', async () => {
  const rules = await config.headers()
  const framing = rules.filter(r => r.headers.some(h => h.key === 'Content-Security-Policy' && /frame-ancestors 'none'/.test(h.value)))
  assert.equal(framing.length, 1)
  const [rule] = framing
  assert.ok(rule.headers.some(h => h.key === 'X-Frame-Options' && h.value === 'DENY'))
  for (const p of ['/', '/hike', '/more', '/city/Vienna', '/testers', '/api/forecast']) assert.equal(matches(rule.source, p), true, p)
  for (const p of ['/widget/Vienna', '/widget/New%20York']) assert.equal(matches(rule.source, p), false, p)
})

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

test('next.config — the Content Security Policy is enforced on every path; /widget gets it without the framing rule', async () => {
  const rules = await config.headers()
  const all = rules.find(r => r.source === '/:path*')
  const csp = all.headers.find(h => h.key === 'Content-Security-Policy')?.value ?? ''
  assert.match(csp, /^default-src 'self'; script-src 'self' 'unsafe-inline'/)
  for (const host of ['plausible.io', 'tile.openstreetmap.org', 'tile.opentopomap.org', 'rainviewer.com']) assert.ok(csp.includes(host), host)
  for (const gone of ['unpkg.com', 'bigdatacloud', 'open-meteo.com']) assert.ok(!csp.includes(gone), `${gone}: Leaflet is our own copy, and "My location" and the place search ask our own server`)
  for (const closed of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-src 'self'"]) assert.ok(csp.includes(closed), closed)
  assert.doesNotMatch(csp, /frame-ancestors/, 'the rule for every path is what /widget gets: it may be framed')
  assert.ok(!rules.some(r => r.headers.some(h => h.key === 'Content-Security-Policy-Report-Only')), 'no report-only header is left: it had no report address, so nobody read it')
  // where two rules set one header Next keeps the later rule's value: the framing rule has to come after
  const framing = rules.findIndex(r => r.headers.some(h => h.key === 'Content-Security-Policy' && /frame-ancestors 'none'/.test(h.value)))
  assert.ok(framing > rules.indexOf(all), 'the framing rule comes after the rule for every path')
  assert.equal(rules[framing].headers.find(h => h.key === 'Content-Security-Policy').value, `${csp}; frame-ancestors 'none'`, 'every other page: the same policy, and no site may frame it')
})

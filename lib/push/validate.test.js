import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashDeviceKey, parseRegister, parseSettings, parsePlan } from './validate.js'

const KEY = 'a'.repeat(43)

test('hashDeviceKey — a url-safe key of 32–128 chars hashes to hex; anything else is null', () => {
  assert.match(hashDeviceKey(KEY), /^[0-9a-f]{64}$/)
  assert.equal(hashDeviceKey(KEY), hashDeviceKey(KEY))
  assert.equal(hashDeviceKey('short'), null)
  assert.equal(hashDeviceKey('x'.repeat(40) + ' '), null)
  assert.equal(hashDeviceKey(undefined), null)
})

test('parseRegister — token and platform required, lang / unit fall back', () => {
  assert.deepEqual(parseRegister({ token: 'f'.repeat(64), platform: 'ios', lang: 'de', unit: 'F' }),
    { ok: true, value: { token: 'f'.repeat(64), platform: 'ios', lang: 'de', unit: 'F' } })
  assert.deepEqual(parseRegister({ token: 'f'.repeat(64), platform: 'android', lang: 'xx' }).value,
    { token: 'f'.repeat(64), platform: 'android', lang: 'en', unit: 'C' })
  assert.equal(parseRegister({ token: 'short', platform: 'ios' }).ok, false)
  assert.equal(parseRegister({ token: 'f'.repeat(64), platform: 'web' }).ok, false)
  assert.equal(parseRegister(null).status, 400)
})

test('parseSettings — only known fields, typed; an empty patch is an error', () => {
  assert.deepEqual(parseSettings({ alert_rain: true, briefing_hour: 6, home_name: '  Wien ', junk: 1 }).value,
    { alert_rain: true, briefing_hour: 6, home_name: 'Wien' })
  assert.deepEqual(parseSettings({ home_name: null }).value, { home_name: null })
  assert.equal(parseSettings({ briefing_hour: 4 }).ok, false)
  assert.equal(parseSettings({ briefing_hour: 7.5 }).ok, false)
  assert.equal(parseSettings({ alert_rain: 'yes' }).ok, false)
  assert.equal(parseSettings({ home_name: 'x'.repeat(81) }).ok, false)
  assert.equal(parseSettings({}).ok, false)
  assert.deepEqual(parseSettings({ lang: 'it', unit: 'F' }).value, { lang: 'it', unit: 'F' })
})

test('parsePlan — a peak and a day from yesterday (time zones) to 7 days ahead', () => {
  const ok = parsePlan({ name: 'Triglav', lat: 46.378, lon: 13.837, elev: 2864, date: '2026-10-03' }, '2026-10-01')
  assert.deepEqual(ok, { ok: true, value: { name: 'Triglav', lat: 46.378, lon: 13.837, elev: 2864, date: '2026-10-03' } })
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: '2026-10-09' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: '2026-09-29' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: '2026-09-30' }, '2026-10-01').ok, true)
  assert.equal(parsePlan({ name: 'T', lat: 95, lon: 13, elev: 2864, date: '2026-10-02' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: '', lat: 46, lon: 13, elev: 2864, date: '2026-10-02' }, '2026-10-01').ok, false)
  assert.equal(parsePlan({ name: 'T', lat: 46, lon: 13, elev: 2864, date: 'soon' }, '2026-10-01').ok, false)
})

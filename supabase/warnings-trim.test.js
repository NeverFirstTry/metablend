import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { trimFeed } from '../lib/warnings/trim.js'

// The database trims the MeteoAlarm feeds before Vercel ever sees them
// (warnings-feeds.sql); this runs that SQL in a real Postgres (PGlite) and
// checks it agrees with lib/warnings/trim.js, whose output the parser is
// tested against.
const sql = fs.readFileSync(new URL('./warnings-trim.sql', import.meta.url), 'utf8')
const fixture = name => JSON.parse(fs.readFileSync(new URL(`../lib/warnings/__fixtures__/${name}.json`, import.meta.url), 'utf8'))

const db = new PGlite()
await db.exec(sql)
const trimSql = async (feed, cutoff) => (await db.query('select public.trim_warning_feed($1::jsonb, $2::timestamptz) as t', [JSON.stringify(feed), new Date(cutoff).toISOString()])).rows[0].t

const alert = (id, extra = {}, info = {}) => ({
  alert: {
    identifier: id, msgType: 'Alert', status: 'Actual', sent: '2026-10-08T06:00:00+02:00', ...extra,
    info: [{ language: 'de-DE', expires: '2026-10-08T20:00:00+02:00', parameter: [{ valueName: 'awareness_level', value: '3; orange; Severe' }], ...info }],
  },
})
const NOW = Date.parse('2026-10-08T12:00:00+02:00')

test('trim_warning_feed — the same as trimFeed on the real German and Spanish feeds', async () => {
  for (const name of ['feed-germany', 'feed-spain']) {
    const json = fixture(name)
    const sent = Math.min(...json.warnings.map(w => Date.parse(w.alert.sent)))
    for (const cutoff of [sent, sent + 12 * 3600e3]) {
      assert.deepEqual(await trimSql(json, cutoff), trimFeed(json, cutoff), `${name} @ ${new Date(cutoff).toISOString()}`)
    }
  }
})

test('trim_warning_feed — the same as trimFeed on the odd cases: green, cancel, exercise, expired, broken times, no info, not a feed', async () => {
  const feed = { warnings: [
    alert('on'), alert('green', {}, { parameter: [{ valueName: 'awareness_level', value: '1; green; Minor' }] }),
    alert('cancel', { msgType: 'Cancel', references: 'x,on,2026' }), alert('test', { status: 'Exercise' }),
    alert('old', {}, { expires: '2026-10-07T20:00:00+02:00' }), alert('junk-time', {}, { expires: 'soon' }),
    { alert: { identifier: 'no-info', msgType: 'Alert', status: 'Actual' } }, { nothing: true },
    alert('second-info', {}, {}),
  ] }
  feed.warnings[8].alert.info.unshift({ language: 'en', expires: '2026-10-09T20:00:00+02:00', parameter: [] }) // level only in the 2nd info
  assert.deepEqual(await trimSql(feed, NOW - 3600e3), trimFeed(feed, NOW - 3600e3))
  for (const bad of [{}, { warnings: 'x' }, null]) assert.deepEqual(await trimSql(bad, NOW), trimFeed(bad, NOW))
})

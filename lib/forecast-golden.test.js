// The forecast blend as a golden record: a live miss recorded once (scripts/record-golden.mjs: every
// outside answer of one request and the clock), replayed through the real route, must give the same
// blend and store the same rows. It guards the refactors that cut Open-Meteo requests (2026-11-09,
// quota card) against changing a single value a visitor sees. Re-record only when the blend is meant
// to change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { GOLDEN_DIR, replay } from './test-golden.js'

const recordings = fs.existsSync(GOLDEN_DIR) ? fs.readdirSync(GOLDEN_DIR).filter(d => fs.existsSync(path.join(GOLDEN_DIR, d, 'expected.json'))) : []
assert.ok(recordings.length, 'no golden recording: node --import ./lib/test-jsx-hooks.js scripts/record-golden.mjs')

for (const name of recordings) {
  test(`golden ${name}: the recorded answers give the recorded blend and stored rows`, async () => {
    const dir = path.join(GOLDEN_DIR, name)
    const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'))
    const got = await replay(dir)
    assert.equal(got.status, 200)
    assert.deepEqual(got.payload, expected.payload)
    assert.deepEqual(got.stored, expected.stored)
  })
}

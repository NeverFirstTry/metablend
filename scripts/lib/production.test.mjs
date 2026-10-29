import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEnv, confirmArg } from './production.mjs'
import { PRODUCTION_REF } from '../../lib/db-target.js'

test('parseEnv — KEY=value lines; comments, blanks and quotes handled, = inside values kept', () => {
  assert.deepEqual(parseEnv('# a comment\nA=1\n\nB = "two"\r\nC=x=y\nCRON_SECRET =z'), { A: '1', B: 'two', C: 'x=y', CRON_SECRET: 'z' })
})

test('confirmArg — only --confirm=<the production ref> confirms a run without a prompt', () => {
  assert.equal(confirmArg(['node', 's.mjs', `--confirm=${PRODUCTION_REF}`]), PRODUCTION_REF)
  assert.equal(confirmArg(['node', 's.mjs']), null)
})

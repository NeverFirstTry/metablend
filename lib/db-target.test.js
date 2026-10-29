import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCTION_REF, isProductionUrl, writeBlocked } from './db-target.js'

const PROD = `https://${PRODUCTION_REF}.supabase.co`

test('isProductionUrl — the production project by its ref, nothing else', () => {
  assert.equal(isProductionUrl(PROD), true)
  assert.equal(isProductionUrl(`${PROD}/rest/v1`), true)
  assert.equal(isProductionUrl('https://abcdefghijklmnopqrst.supabase.co'), false)
  assert.equal(isProductionUrl(undefined), false)
})

test('writeBlocked — production is written only by the deployed site or an admin script after its confirmation', () => {
  assert.equal(writeBlocked(PROD, {}), true) // a local server, script or test
  assert.equal(writeBlocked(PROD, { VERCEL: '1' }), false)
  assert.equal(writeBlocked(PROD, { METABLEND_PRODUCTION_CONFIRMED: PRODUCTION_REF }), false)
  assert.equal(writeBlocked(PROD, { METABLEND_PRODUCTION_CONFIRMED: '1' }), true) // only the ref itself confirms
  assert.equal(writeBlocked('https://abcdefghijklmnopqrst.supabase.co', {}), false) // the dev project: anything goes
})

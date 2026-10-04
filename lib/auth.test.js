import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isInternal, isAuthorizedJob, jobKeyProblem, secretMatches, selfBase } from './auth.js'

const req = headers => new Request('https://metablend.app/api/forecast', { headers })

test('isInternal — only with the calibrate secret configured and matching', () => {
  const before = process.env.CALIBRATE_SECRET
  try {
    delete process.env.CALIBRATE_SECRET
    assert.equal(isInternal(req({ 'x-calibrate-key': '' })), false)
    process.env.CALIBRATE_SECRET = 's3cret'
    assert.equal(isInternal(req({ 'x-calibrate-key': 's3cret' })), true)
    assert.equal(isInternal(req({ 'x-calibrate-key': 'nope' })), false)
    assert.equal(isInternal(req({})), false)
  } finally {
    if (before === undefined) delete process.env.CALIBRATE_SECRET
    else process.env.CALIBRATE_SECRET = before
  }
})

const withEnv = (vars, fn) => {
  const before = { CRON_SECRET: process.env.CRON_SECRET, CALIBRATE_SECRET: process.env.CALIBRATE_SECRET }
  try {
    for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    fn()
  } finally {
    for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
}

test('isAuthorizedJob — fails closed: no secret configured lets nobody in', () => {
  withEnv({ CRON_SECRET: undefined, CALIBRATE_SECRET: undefined }, () => {
    assert.equal(isAuthorizedJob(req({})), false)
    assert.equal(isAuthorizedJob(req({ authorization: 'Bearer ' })), false)
  })
})

test('isAuthorizedJob — the cron secret as a bearer, or the calibrate secret', () => {
  withEnv({ CRON_SECRET: 'cron-1', CALIBRATE_SECRET: 'cal-1' }, () => {
    assert.equal(isAuthorizedJob(req({ authorization: 'Bearer cron-1' })), true)
    assert.equal(isAuthorizedJob(req({ 'x-calibrate-key': 'cal-1' })), true)
    assert.equal(isAuthorizedJob(req({ authorization: 'Bearer cal-1' })), true)
    assert.equal(isAuthorizedJob(req({ authorization: 'Bearer cron-2' })), false)
    assert.equal(isAuthorizedJob(req({})), false)
  })
  withEnv({ CRON_SECRET: undefined, CALIBRATE_SECRET: 'cal-1' }, () => {
    assert.equal(isAuthorizedJob(req({ 'x-calibrate-key': 'cal-1' })), true)
    assert.equal(isAuthorizedJob(req({ authorization: 'Bearer anything' })), false)
  })
})

test('jobKeyProblem — the calibrate key must be configured (503) and match (401)', () => {
  withEnv({ CALIBRATE_SECRET: undefined }, () => {
    assert.equal(jobKeyProblem(req({ 'x-calibrate-key': 'x' }))?.status, 503)
  })
  withEnv({ CALIBRATE_SECRET: 'cal-1' }, () => {
    assert.equal(jobKeyProblem(req({ 'x-calibrate-key': 'cal-1' })), null)
    assert.equal(jobKeyProblem(req({ authorization: 'Bearer cal-1' })), null)
    assert.equal(jobKeyProblem(req({ 'x-calibrate-key': 'cal-2' }))?.status, 401)
    assert.equal(jobKeyProblem(req({}))?.status, 401)
  })
})

test('secretMatches — exact match only, any lengths, never with an empty secret', () => {
  assert.equal(secretMatches('abc', 'abc'), true)
  assert.equal(secretMatches('abc', 'abcd'), false)
  assert.equal(secretMatches('', ''), false)
  assert.equal(secretMatches(null, 'abc'), false)
  assert.equal(secretMatches('abc', undefined), false)
})

test('selfBase — where the site fetches itself with a secret: never a host from the request', () => {
  const before = process.env.VERCEL_ENV
  try {
    process.env.VERCEL_ENV = 'production'
    assert.equal(selfBase(new Request('https://metablend-abc.vercel.app/api/forecast')), 'https://metablend.app')
    delete process.env.VERCEL_ENV
    assert.equal(selfBase(new Request('http://localhost:3123/api/forecast')), 'http://localhost:3123')
    assert.equal(selfBase(new Request('http://127.0.0.1:3000/x')), 'http://127.0.0.1:3000')
    // a forged Host header on a machine reachable from the network
    assert.equal(selfBase(new Request('http://evil.example/api/forecast')), 'http://localhost:3000')
  } finally {
    if (before === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = before
  }
})

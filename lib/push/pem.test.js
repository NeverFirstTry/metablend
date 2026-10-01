import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, createPrivateKey } from 'node:crypto'
import { normalizePem, readableKey } from './pem.js'

const keys = {
  firebase: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
  apns: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
}
const der = pem => createPrivateKey(pem).export({ type: 'pkcs8', format: 'der' }).toString('base64')

test('normalizePem — any way a key survives a paste into Vercel comes back usable', () => {
  for (const [name, pem] of Object.entries(keys)) {
    const pasted = {
      'as is': pem,
      'literal \\n (copied from the JSON)': pem.replace(/\n/g, '\\n'),
      'doubled \\\\n': pem.replace(/\n/g, '\\\\n'),
      'line breaks turned into spaces': pem.replace(/\n/g, ' '),
      'Windows line endings': pem.replace(/\n/g, '\r\n'),
      'quoted, JSON style': `"${pem.replace(/\n/g, '\\n')}"`,
      'no line breaks at all': pem.replace(/\n/g, ''),
    }
    for (const [how, raw] of Object.entries(pasted)) {
      const fixed = normalizePem(raw)
      assert.ok(readableKey(fixed), `${name}: ${how}`)
      assert.equal(der(fixed), der(pem), `${name}: ${how}`)
    }
  }
})

test('normalizePem — no key markers, no key', () => {
  assert.equal(normalizePem('MIIEvQIBADANBg'), null)
  assert.equal(normalizePem(''), null)
  assert.equal(normalizePem(undefined), null)
  assert.equal(readableKey(normalizePem('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----')), false)
})

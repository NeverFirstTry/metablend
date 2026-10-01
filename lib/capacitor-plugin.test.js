import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPlugin } from './capacitor-plugin.js'

// Like Capacitor's plugin proxy: every property, `then` included, is a
// method — and an unknown method's promise never calls back.
const capacitorLikeProxy = () => new Proxy({}, {
  get: (_, prop) => (prop === 'checkPermissions' ? async () => ({ receive: 'prompt' }) : () => new Promise(() => {})),
})
const settles = (p, ms = 200) => Promise.race([p.then(() => 'settled'), new Promise(r => setTimeout(() => r('hung'), ms))])

test('the trap: returning a plugin proxy from an async function never settles', async () => {
  const naive = async () => (await Promise.resolve({ Push: capacitorLikeProxy() })).Push
  assert.equal(await settles(naive()), 'hung')
})

test('loadPlugin — hands the plugin over inside a plain object, so it can be awaited', async () => {
  const { plugin } = await loadPlugin(async () => ({ Push: capacitorLikeProxy() }), 'Push')
  assert.deepEqual(await plugin.checkPermissions(), { receive: 'prompt' })
  assert.equal(await settles(loadPlugin(async () => ({ Push: capacitorLikeProxy() }), 'Push')), 'settled')
})

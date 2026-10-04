import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRegistry } from './i18n-registry.js'

const en = { hello: 'Hello' }, de = { hello: 'Hallo' }
const counting = (packs, fail = new Set()) => {
  const calls = {}
  const loaders = Object.fromEntries(Object.entries(packs).map(([code, pack]) => [code, async () => {
    calls[code] = (calls[code] ?? 0) + 1
    if (fail.has(code)) throw new Error('offline')
    return { default: pack }
  }]))
  return { loaders, calls }
}

test('registry — English is there from the start, another language once it has loaded (once)', async () => {
  const { loaders, calls } = counting({ de })
  const r = createRegistry({ en }, loaders, () => undefined)
  assert.equal(r.pack('en'), en)
  assert.equal(r.pack('de'), undefined)
  assert.equal(r.has('de'), false)
  const [a, b] = await Promise.all([r.load('de'), r.load('de')])
  assert.equal(a && b, true)
  assert.equal(r.pack('de'), de)
  assert.equal(await r.load('de'), true)
  assert.equal(calls.de, 1)
})

test('registry — a failed load says so, leaves English in charge, and can be retried', async () => {
  const fail = new Set(['de'])
  const { loaders, calls } = counting({ de }, fail)
  const r = createRegistry({ en }, loaders, () => undefined)
  assert.equal(await r.load('de'), false)
  assert.equal(r.has('de'), false)
  fail.delete('de')
  assert.equal(await r.load('de'), true)
  assert.equal(calls.de, 2)
})

test('registry — unknown codes and English need no loading', async () => {
  const { loaders, calls } = counting({ de })
  const r = createRegistry({ en }, loaders, () => undefined)
  assert.equal(await r.load('xx'), false)
  assert.equal(await r.load('en'), true)
  assert.deepEqual(calls, {})
})

test('registry — settled() waits for every language still on its way', async () => {
  let release
  const r = createRegistry({ en }, { de: () => new Promise(res => { release = () => res({ default: de }) }) }, () => undefined)
  r.load('de')
  let done = false
  const s = r.settled().then(() => { done = true })
  await Promise.resolve()
  assert.equal(done, false)
  release()
  await s
  assert.equal(done, true)
  assert.equal(r.pack('de'), de)
})

test('registry — a language the server inlined in the page counts as loaded', async () => {
  const { loaders, calls } = counting({ de })
  const r = createRegistry({ en }, loaders, () => ({ de }))
  assert.equal(r.has('de'), true)
  assert.equal(r.pack('de'), de)
  assert.equal(await r.load('de'), true)
  assert.deepEqual(calls, {})
})

test('registry — loadAll brings in every language (server and tests)', async () => {
  const { loaders } = counting({ de, fr: { hello: 'Bonjour' } })
  const r = createRegistry({ en }, loaders, () => undefined)
  await r.loadAll()
  assert.equal(r.pack('fr').hello, 'Bonjour')
})

test('lib/i18n.js — only English is imported statically; the others load on demand', () => {
  const src = readFileSync(new URL('./i18n.js', import.meta.url), 'utf8')
  const statics = [...src.matchAll(/^import \w+ from '\.\/i18n\/(\w+)\.js'/gm)].map(m => m[1])
  assert.deepEqual(statics, ['en'])
  for (const code of ['de', 'fr', 'ja', 'zh', 'ko', 'pt']) assert.match(src, new RegExp(`import\\('\\./i18n/${code}\\.js'\\)`), code)
})

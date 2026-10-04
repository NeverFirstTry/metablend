import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampScale, applyTextScale, watchTextScale, rememberTextScale } from './text-scale.js'
import { TEXT_SCALE_KEY } from './app-client.js'
import { readFileSync } from 'node:fs'

test('clampScale — 1 to 2, steps of 0.05, junk is 1', () => {
  assert.deepEqual([0.8, 1, 1.12, 1.18, 2.4, NaN, null, '1.3'].map(clampScale), [1, 1, 1.1, 1.2, 2, 1, 1, 1.3])
})

test('applyTextScale — sets the root size above 1, clears it at 1', () => {
  const root = { style: { fontSize: '' }, dataset: {} }
  applyTextScale(1.5, root)
  assert.equal(root.style.fontSize, '24px')
  applyTextScale(1, root)
  assert.equal(root.style.fontSize, '')
})

test('applyTextScale — flags large text from 1.3 so cut-off lines can wrap', () => {
  const root = { style: { fontSize: '' }, dataset: {} }
  applyTextScale(1.2, root)
  assert.equal(root.dataset.textLarge, undefined)
  applyTextScale(1.3, root)
  assert.equal(root.dataset.textLarge, '1')
  applyTextScale(1, root)
  assert.equal(root.dataset.textLarge, undefined)
})

const page = () => ({ style: { fontSize: '' }, dataset: {} })
const memory = () => { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

test('watchTextScale — an older app without the TextScale plugin: nothing changes, no error', async () => {
  const root = page(), storage = memory()
  const core = { registerPlugin: () => ({ get: () => Promise.reject(new Error('"TextScale" plugin is not implemented on ios')) }) }
  const off = await watchTextScale({ native: true, core, root, storage })
  assert.equal(typeof off, 'function')
  off()
  assert.equal(root.style.fontSize, '')
  assert.equal(storage.m.size, 0)
})

test('watchTextScale — applies the phone setting, remembers it for the next launch, follows changes', async () => {
  const root = page(), storage = memory()
  let onChange = null, removed = false
  const core = { registerPlugin: () => ({
    get: async () => ({ scale: 1.5 }),
    addListener: async (name, cb) => { assert.equal(name, 'change'); onChange = cb; return { remove: () => { removed = true } } },
  }) }
  const off = await watchTextScale({ native: true, core, root, storage })
  assert.equal(root.style.fontSize, '24px')
  assert.equal(storage.getItem(TEXT_SCALE_KEY), '1.5')
  onChange({ scale: 1 })
  assert.equal(root.style.fontSize, '')
  assert.equal(storage.getItem(TEXT_SCALE_KEY), '1')
  off()
  assert.equal(removed, true)
})

test('watchTextScale — the website never asks for the plugin', async () => {
  let asked = false
  const off = await watchTextScale({ native: false, core: { registerPlugin: () => { asked = true } } })
  assert.equal(typeof off, 'function')
  assert.equal(asked, false)
})

test('rememberTextScale — storage that throws (private mode) is fine', () => {
  assert.doesNotThrow(() => rememberTextScale(1.5, { setItem: () => { throw new Error('quota') } }))
})

test('globals.css — at large text, rows with a cut-off line wrap; column and no-wrap boxes are left alone', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  const rule = css.match(/:root\[data-text-large\][^{]*:has\(> ?\.truncate\)[^{]*\{[^}]*\}/)
  assert.ok(rule, 'the wrap rule exists')
  assert.match(rule[0], /flex-wrap: ?wrap/)
  assert.match(rule[0], /:not\([^)]*\.flex-col/)
  assert.match(rule[0], /:not\([^)]*\.flex-nowrap/)
})

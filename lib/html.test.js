import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, jsonForScript, ilikeExact } from './html.js'

test('escapeHtml — markup in user text is shown, never parsed', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
  )
  assert.equal(escapeHtml(`Rock & Roll's`), 'Rock &amp; Roll&#39;s')
})

test('escapeHtml — plain city names and numbers pass through unchanged', () => {
  assert.equal(escapeHtml('São Paulo'), 'São Paulo')
  assert.equal(escapeHtml(17.5), '17.5')
})

test('escapeHtml — null/undefined render as empty, not "null"', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
})

test('jsonForScript — JSON inside a <script> tag can\'t close the tag', () => {
  const out = jsonForScript({ name: '</script><script>alert(1)</script>', n: 1 })
  assert.equal(out.includes('<'), false)
  assert.deepEqual(JSON.parse(out), { name: '</script><script>alert(1)</script>', n: 1 })
})

test('ilikeExact — a city name matches itself, never as a wildcard pattern', () => {
  assert.equal(ilikeExact('Vienna'), 'Vienna')
  assert.equal(ilikeExact('%'), '\\%')
  assert.equal(ilikeExact('a_b'), 'a\\_b')
  assert.equal(ilikeExact('back\\slash'), 'back\\\\slash')
})

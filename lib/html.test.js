import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from './html.js'

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

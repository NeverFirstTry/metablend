import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readThemePref, resolveTheme, THEME_BOOT_SCRIPT } from './theme.js'

test('readThemePref — only an explicit dark or light is a choice; the rest follows the device', () => {
  assert.equal(readThemePref('light'), 'light')
  assert.equal(readThemePref('dark'), 'dark')
  assert.equal(readThemePref('system'), 'system')
  assert.equal(readThemePref(null), 'system')
  assert.equal(readThemePref('purple'), 'system')
})

test('resolveTheme — system follows the device, a choice wins over it', () => {
  assert.equal(resolveTheme('system', true), 'light')
  assert.equal(resolveTheme('system', false), 'dark')
  assert.equal(resolveTheme('dark', true), 'dark')
  assert.equal(resolveTheme('light', false), 'light')
})

// Runs the inline boot script against a fake page; reports the theme it set.
function boot(cookie, prefersLight) {
  const html = { dataset: {} }
  const matchMedia = q => ({ matches: q === '(prefers-color-scheme: light)' && prefersLight })
  new Function('document', 'matchMedia', THEME_BOOT_SCRIPT)({ cookie, documentElement: html }, matchMedia)
  return html.dataset.theme ?? 'dark'
}

test('THEME_BOOT_SCRIPT — the device setting by default, a stored choice over it', () => {
  assert.equal(boot('', true), 'light')
  assert.equal(boot('', false), 'dark')
  assert.equal(boot('metablend_theme=system', true), 'light')
  assert.equal(boot('metablend_theme=dark', true), 'dark')
  assert.equal(boot('a=1; metablend_theme=light', false), 'light') // not the first cookie
  assert.equal(boot('metablend_themes=light', false), 'dark') // another cookie's name
})

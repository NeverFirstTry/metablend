import { test } from 'node:test'
import assert from 'node:assert/strict'
import { iconChoices, selectedIcon, switchNeedsWarning } from './app-icon-choices.js'

test('iconChoices — iPhone: Automatic plus the three; Android: Sky first, no Automatic; elsewhere none', () => {
  assert.deepEqual(iconChoices('ios'), ['auto', 'light', 'dark', 'sky'])
  assert.deepEqual(iconChoices('android'), ['sky', 'light', 'dark'])
  assert.deepEqual(iconChoices('web'), [])
  assert.deepEqual(iconChoices(undefined), [])
})

test('selectedIcon — what the phone reports, else the platform default', () => {
  assert.equal(selectedIcon('ios', 'dark'), 'dark')
  assert.equal(selectedIcon('ios', 'auto'), 'auto')
  assert.equal(selectedIcon('ios', null), 'auto')
  assert.equal(selectedIcon('android', 'light'), 'light')
  assert.equal(selectedIcon('android', 'auto'), 'sky')
  assert.equal(selectedIcon('web', 'sky'), null)
})

test('switchNeedsWarning — only Android may drop the icon from the home screen', () => {
  assert.equal(switchNeedsWarning('android'), true)
  assert.equal(switchNeedsWarning('ios'), false)
})

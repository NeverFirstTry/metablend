import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { iconChoices, selectedIcon, switchNeedsWarning } from './app-icon-choices.js'

const ALL = ['slate', 'glow', 'gold', 'light', 'butter', 'summit', 'weather', 'dots', 'mono', 'winter', 'sky']

test('iconChoices — the icons the app build lists, in picker order, Slate first; elsewhere none', () => {
  assert.deepEqual(iconChoices('ios', [...ALL].reverse()), ALL)
  assert.deepEqual(iconChoices('android', ALL), ALL)
  assert.deepEqual(iconChoices('android', ['sky', 'slate', 'someday']), ['slate', 'sky'])
  assert.deepEqual(iconChoices('web', ALL), [])
  assert.deepEqual(iconChoices(undefined, ALL), [])
})

test('iconChoices — a build from before 2026-11-10 lists no icons and gets no picker', () => {
  assert.deepEqual(iconChoices('ios', undefined), [])
  assert.deepEqual(iconChoices('android', null), [])
})

test('selectedIcon — what the phone reports, else Slate', () => {
  assert.equal(selectedIcon('ios', 'summit', ALL), 'summit')
  assert.equal(selectedIcon('android', 'sky', ALL), 'sky')
  assert.equal(selectedIcon('ios', 'auto', ALL), 'slate')
  assert.equal(selectedIcon('android', 'dark', ALL), 'slate')
  assert.equal(selectedIcon('ios', null, ALL), 'slate')
  assert.equal(selectedIcon('web', 'sky', ALL), null)
  assert.equal(selectedIcon('ios', 'sky', undefined), null)
})

test('switchNeedsWarning — only Android may drop the icon from the home screen', () => {
  assert.equal(switchNeedsWarning('android'), true)
  assert.equal(switchNeedsWarning('ios'), false)
})

// the picker, the native code and the assets name the same icons
test('every icon has its preview, its label, its iPhone set and its Android launcher entry', () => {
  const en = readFileSync('lib/i18n/en.js', 'utf8')
  const manifest = readFileSync('mobile/android/app/src/main/AndroidManifest.xml', 'utf8')
  const plugin = readFileSync('mobile/android/app/src/main/java/app/metablend/AppIconPlugin.java', 'utf8')
  const pbx = readFileSync('mobile/ios/App/App.xcodeproj/project.pbxproj', 'utf8')
  const swift = readFileSync('mobile/ios/App/App/AppDelegate.swift', 'utf8')
  const Name = id => id[0].toUpperCase() + id.slice(1)
  for (const id of ALL) {
    assert.ok(existsSync(`public/app-icons/${id}.png`), `preview ${id}`)
    assert.match(en, new RegExp(`appIcon${Name(id)}: '`), `label ${id}`)
    assert.match(manifest, new RegExp(`android:name="\\.Launcher${Name(id)}"`), `launcher ${id}`)
    assert.match(plugin, new RegExp(`"${id}"`), `Android plugin ${id}`)
    if (id === 'slate') continue // the primary icon
    assert.ok(existsSync(`mobile/ios/App/App/Assets.xcassets/AppIcon-${Name(id)}.appiconset/Contents.json`), `iPhone set ${id}`)
    assert.match(pbx, new RegExp(`ALTERNATE_APPICON_NAMES = "[^"]*AppIcon-${Name(id)}\\b`), `Xcode alternate ${id}`)
    assert.match(swift, new RegExp(`"${id}"`), `iPhone plugin ${id}`)
  }
  // the manifest switches on Slate alone
  assert.deepEqual([...manifest.matchAll(/android:name="\.Launcher(\w+)"\s+android:enabled="true"/g)].map(m => m[1]), ['Slate'])
})

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

// owner, 2026-11-22: a website change must never take a working feature from an older app build. TestFlight build 3
// (version 1.0) lists no icons; it switches among the four it was built with, and lost its picker on 2026-11-10
test('iconChoices — a build from before 2026-11-10 lists no icons and keeps the ones it was built with', () => {
  assert.deepEqual(iconChoices('ios', undefined), ['auto', 'light', 'dark', 'sky'])
  assert.deepEqual(iconChoices('android', null), ['sky', 'light', 'dark'])
  assert.deepEqual(iconChoices('web', undefined), [])
})

test('selectedIcon — what the phone reports, else Slate', () => {
  assert.equal(selectedIcon('ios', 'summit', ALL), 'summit')
  assert.equal(selectedIcon('android', 'sky', ALL), 'sky')
  assert.equal(selectedIcon('ios', 'auto', ALL), 'slate')
  assert.equal(selectedIcon('android', 'dark', ALL), 'slate')
  assert.equal(selectedIcon('ios', null, ALL), 'slate')
  assert.equal(selectedIcon('web', 'sky', ALL), null)
  // an older build: what it reports among its own four, else its first
  assert.equal(selectedIcon('ios', 'sky', undefined), 'sky')
  assert.equal(selectedIcon('ios', 'auto', undefined), 'auto')
  assert.equal(selectedIcon('android', 'dark', null), 'dark')
  assert.equal(selectedIcon('android', 'summit', null), 'sky')
})

// an older build's own icons: their previews as that build draws them (light and sky look different now), their labels
test('an older build\'s icons have their old previews and their labels in every language', async () => {
  for (const id of ['auto', 'light', 'dark', 'sky']) assert.ok(existsSync(`public/app-icons/legacy/${id}.png`), `legacy preview ${id}`)
  for (const l of ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko']) {
    const p = (await import(`./i18n/${l}.js`)).default
    assert.deepEqual(['appIconAuto', 'appIconLight', 'appIconDark', 'appIconSky', 'appIconAutoHint'].filter(k => !p[k]), [], l)
  }
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

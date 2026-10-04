import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const read = p => fs.readFileSync(new URL(p, root), 'utf8').trim()

test('project settings — no encryption question, iPhone only, release signing from an ignored file', () => {
  assert.match(read('mobile/ios/App/App/Info.plist'), /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/)
  const pbx = read('mobile/ios/App/App.xcodeproj/project.pbxproj')
  assert.doesNotMatch(pbx, /TARGETED_DEVICE_FAMILY = "1,2"/)
  assert.equal((pbx.match(/TARGETED_DEVICE_FAMILY = 1;/g) ?? []).length, 4)
  const gradle = read('mobile/android/app/build.gradle')
  assert.match(gradle, /keystore\.properties/)
  assert.match(gradle, /signingConfigs\s*\{\s*release/)
  const ignore = read('mobile/android/.gitignore')
  for (const p of ['keystore.properties', '*.jks', '*.keystore']) assert.ok(ignore.split('\n').includes(p), p)
})

test('compliance sheet — every store form has its answers', () => {
  const md = read('store/compliance.md')
  for (const h of ['## App Store — App Privacy', '## Google Play — Data safety', '## Content rating', '## Export compliance', '## Target audience', '## Ads', '## App access']) assert.ok(md.includes(h), h)
})

// ITMS-90683: the location plugin also references "always" location APIs, so
// App Store Connect wants that purpose string too, even though the app only
// ever asks for "while using".
test('location purpose strings — both keys in Info.plist, both translated into the same languages', () => {
  const plist = read('mobile/ios/App/App/Info.plist')
  const keys = ['NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription']
  for (const k of keys) assert.match(plist, new RegExp(`<key>${k}</key>\\s*<string>[^<]{10,}</string>`), k)
  const strings = JSON.parse(read('mobile/ios/App/App/InfoPlist.xcstrings')).strings
  const locales = Object.keys(strings[keys[0]].localizations).sort()
  assert.equal(locales.length, 13)
  assert.deepEqual(Object.keys(strings[keys[1]]?.localizations ?? {}).sort(), locales)
  for (const [lang, l] of Object.entries(strings[keys[1]].localizations)) assert.ok(l.stringUnit.value.length >= 10, lang)
})

test('secrets hygiene — key files ignored at the root, the device key not in Android backups', () => {
  const ignore = read('.gitignore').split(/\r?\n/)
  for (const p of ['*.p8', '*.p12', '*.jks', '*.keystore', 'google-services.json', 'GoogleService-Info.plist', '*service-account*.json']) assert.ok(ignore.includes(p), p)
  assert.match(read('mobile/android/app/src/main/AndroidManifest.xml'), /android:allowBackup="false"/)
})

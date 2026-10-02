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

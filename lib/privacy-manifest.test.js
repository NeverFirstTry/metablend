// Apple's privacy manifest (PrivacyInfo.xcprivacy): an app that uses UserDefaults must say why, in the app
// and in every extension that uses it. Ours do: the app for its own settings and for the app group it
// shares with the widgets (AppDelegate.swift, WidgetBridgePlugin), the widget extension for that group
// (MetaBlendWidgets.swift). Without the declaration App Store Connect flags or refuses the upload
// (ITMS-91053). Not compiled here (Windows): these tests hold the files and the project together.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const IOS = 'mobile/ios/App'
const read = p => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')
const app = read(`${IOS}/App/PrivacyInfo.xcprivacy`), widgets = read(`${IOS}/MetaBlendWidgets/PrivacyInfo.xcprivacy`)
const project = read(`${IOS}/App.xcodeproj/project.pbxproj`)
const strings = xml => [...xml.matchAll(/<string>([^<]+)<\/string>/g)].map(m => m[1])
// the reason codes declared for UserDefaults
const reasons = xml => strings(xml.match(/NSPrivacyAccessedAPICategoryUserDefaults<\/string>\s*<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '').sort()

test('the app declares UserDefaults for its own settings (CA92.1) and for the app group it shares with the widgets (1C8F.1)', () => {
  assert.deepEqual(reasons(app), ['1C8F.1', 'CA92.1'])
})

test('the widget extension declares UserDefaults for the app group (1C8F.1), the only store it reads', () => {
  assert.deepEqual(reasons(widgets), ['1C8F.1'])
  const swift = fs.readdirSync(`${IOS}/MetaBlendWidgets`).filter(f => f.endsWith('.swift')).map(f => read(`${IOS}/MetaBlendWidgets/${f}`)).join('\n')
  assert.doesNotMatch(swift, /UserDefaults\.standard/, 'a widget file reads the standard store: the manifest then needs CA92.1 too')
})

test('neither manifest declares tracking, and both are property lists', () => {
  for (const xml of [app, widgets]) {
    assert.match(xml, /<key>NSPrivacyTracking<\/key>\s*<false\/>/)
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<!DOCTYPE plist [^>]+>\s*<plist version="1\.0">\s*<dict>[\s\S]*<\/dict>\s*<\/plist>\s*$/)
    // every opened array and dict is closed
    for (const tag of ['dict', 'array']) assert.equal(xml.split(`<${tag}>`).length, xml.split(`</${tag}>`).length, tag)
  }
})

test('the app\'s manifest is in the App target: a file of the project and one of its resources', () => {
  assert.match(project, /\/\* PrivacyInfo\.xcprivacy \*\/ = \{isa = PBXFileReference;[^}]*path = PrivacyInfo\.xcprivacy;/)
  assert.match(project, /\/\* PrivacyInfo\.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile;/)
  const appResources = project.match(/504EC3021FED79650016851F \/\* Resources \*\/ = \{[\s\S]*?\};/)[0]
  assert.match(appResources, /PrivacyInfo\.xcprivacy in Resources/)
  const appGroup = project.match(/children = \(([^)]*AppDelegate\.swift[^)]*)\);/)[1]
  assert.match(appGroup, /PrivacyInfo\.xcprivacy/)
})

test('the widgets\' manifest is in the extension: its folder is synchronised with the target and the file is not excepted', () => {
  assert.match(project, /isa = PBXFileSystemSynchronizedRootGroup;[^\n]*path = MetaBlendWidgets;/)
  const excepted = project.match(/membershipExceptions = \(([^)]*)\);/)[1]
  assert.doesNotMatch(excepted, /PrivacyInfo/)
})

test('the app names the data types the App Store form names (store/compliance.md), linked or not as there', () => {
  const form = read('store/compliance.md').split('## App Store')[1].split('\n## ')[0]
  const part = (from, to) => form.slice(form.indexOf(from), to ? form.indexOf(to) : undefined)
  const named = text => [...text.matchAll(/→ \*\*([^*]+)\*\*/g)].map(m => m[1].replace(/\s/g, '')).sort()
  const declared = linked => [...app.matchAll(/NSPrivacyCollectedDataType<\/key>\s*<string>NSPrivacyCollectedDataType(\w+)<\/string>\s*<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<(true|false)\/>/g)]
    .filter(m => (m[2] === 'true') === linked).map(m => m[1]).sort()
  assert.deepEqual(declared(true), named(part('Data linked to you', 'Data not linked to you')))
  assert.deepEqual(declared(false), named(part('Data not linked to you', 'Precise Location')))
  assert.equal(declared(true).length + declared(false).length, 6)
  // analytics for the two analytics types, app functionality for the rest; none used for tracking
  assert.equal((app.match(/NSPrivacyCollectedDataTypePurposeAnalytics/g) ?? []).length, 2)
  assert.equal((app.match(/NSPrivacyCollectedDataTypePurposeAppFunctionality/g) ?? []).length, 4)
  assert.equal((app.match(/<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<false\/>/g) ?? []).length, 6)
})

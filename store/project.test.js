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
  for (const p of ['keystore.properties', '*.jks', '*.keystore']) assert.ok(ignore.split(/\r?\n/).includes(p), p)
})

test('iPhone only — no iPad keys in any Info.plist, and the store screenshots are iPhone and Android phones only', () => {
  for (const p of ['mobile/ios/App/App/Info.plist', 'mobile/ios/App/MetaBlendWidgets/Info.plist']) assert.doesNotMatch(read(p), /~ipad|UIRequiresFullScreen|UIDeviceFamily/i, p)
  const devices = [...read('scripts/store-shots.mjs').matchAll(/\{ id: '(\w+)', w: (\d+), h: (\d+), scale: (\d+)/g)].map(m => m.slice(1).join(' '))
  assert.deepEqual(devices, ['ios 430 932 3', 'android 360 640 3']) // 1290×2796 (the 6.9" set) and 1080×1920
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

// store/compliance.md answers "Precise location: not collected": the app may only ask for the approximate one
test('Android asks for the approximate location only, never the precise one', () => {
  const manifest = read('mobile/android/app/src/main/AndroidManifest.xml')
  assert.match(manifest, /android\.permission\.ACCESS_COARSE_LOCATION/)
  assert.doesNotMatch(manifest, /android\.permission\.ACCESS_FINE_LOCATION/)
})

// App Store text and screenshots go up from the owner's PC with fastlane deliver (fastlane/Fastfile)
test('fastlane — deliver never uploads a build, submits or releases; the API key comes only from the environment', () => {
  const fastfile = read('fastlane/Fastfile'), appfile = read('fastlane/Appfile')
  for (const s of ['skip_binary_upload: true', 'submit_for_review: false', 'automatic_release: false', 'ignore_language_directory_validation: true']) assert.ok(fastfile.includes(s), s)
  assert.doesNotMatch(fastfile, /submit_for_review: true|automatic_release: true|skip_binary_upload: false|edit_live/)
  for (const v of ['APP_STORE_CONNECT_API_KEY_KEY_ID', 'APP_STORE_CONNECT_API_KEY_ISSUER_ID', 'APP_STORE_CONNECT_API_KEY_KEY_FILEPATH']) assert.ok(fastfile.includes(`ENV.fetch("${v}")`), v)
  assert.doesNotMatch(fastfile + appfile, /\.p8"|key_id: "|issuer_id: "|key_content|BEGIN PRIVATE KEY/, 'no key, key id or issuer id in the repo')
  assert.match(appfile, /app_identifier\("app\.metablend"\)/)
  const ignore = read('.gitignore').split(/\r?\n/)
  for (const p of ['*.p8', 'fastlane/report.xml', 'fastlane/Preview.html', 'fastlane/README.md']) assert.ok(ignore.includes(p), p)
})

// Every store text, App Store and Google Play, every language (owner 2026-11-11): no em or en dash, and no
// safety promise. The safety words by language, as word starts, so "nebezpečné" (cs) and "nevaren" (sl),
// "dangerous", stay allowed; German "sicher" counts anywhere ("unsicher" too).
const SAFETY_WORDS = /\bsafe|sicher|sécurité|\bsûr|\bsegur|\bsicur|\bveilig|\bbezpiecz|\bbezpeč|\bvar(?:en|na|no|ni|nost)|安全|안전/i
test('store texts — no em or en dash, and no safety words, in fastlane/metadata (App Store and Play, every language)', () => {
  const walk = dir => fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}${e.name}/`) : e.name.endsWith('.txt') ? [`${dir}${e.name}`] : [])
  const files = walk('fastlane/metadata/')
  assert.ok(files.length > 150, `found only ${files.length} store texts`)
  const problems = files.flatMap(f => {
    const t = read(f), dash = t.match(/[—–]/), word = t.match(SAFETY_WORDS)
    return [...(dash ? [`${f}: dash "${dash[0]}"`] : []), ...(word ? [`${f}: "${word[0]}"`] : [])]
  })
  assert.deepEqual(problems, [])
})

test('store texts guard — catches what it is for, and lets "dangerous" through', () => {
  for (const s of ['not a safety guarantee', 'keine Sicherheitsgarantie', 'pas une garantie de sécurité', 'garantía de seguridad', 'gwarancja bezpieczeństwa', 'záruka bezpečí', 'zagotovilo varnosti', '安全を保証', '안전을 보장']) assert.match(s, SAFETY_WORDS, s)
  for (const s of ['nebezpečné počasí', 'nevarno vreme', 'Forecasts can be wrong']) assert.doesNotMatch(s, SAFETY_WORDS, s)
})

// The Play listing goes up the same way with fastlane supply (store/play-upload.md)
test('fastlane — supply never uploads a bundle, releases or changes a track; the Play key comes only from the environment', () => {
  const fastfile = read('fastlane/Fastfile')
  for (const s of ['package_name: "app.metablend"', 'skip_upload_apk: true', 'skip_upload_aab: true', 'skip_upload_changelogs: true', 'ENV.fetch("SUPPLY_JSON_KEY")']) assert.ok(fastfile.includes(s), s)
  assert.doesNotMatch(fastfile, /track_promote_to|release_status|rollout|skip_upload_(apk|aab): false|json_key_data|"private_key"/)
})

test('iOS entitlements — Release builds sign with aps-environment production, Debug keeps development, both carry the widgets\' app group', () => {
  const pbx = read('mobile/ios/App/App.xcodeproj/project.pbxproj')
  const pairs = [...pbx.matchAll(/CODE_SIGN_ENTITLEMENTS = (App\/[^;]+);[\s\S]*?name = (Debug|Release);/g)].map(m => [m[2], m[1]]).sort()
  assert.deepEqual(pairs, [['Debug', 'App/App.entitlements'], ['Release', 'App/AppRelease.entitlements']])
  const aps = file => read(`mobile/ios/App/${file}`).match(/<key>aps-environment<\/key>\s*<string>(\w+)<\/string>/)[1]
  assert.equal(aps('App/App.entitlements'), 'development')
  assert.equal(aps('App/AppRelease.entitlements'), 'production')
  for (const f of ['App/App.entitlements', 'App/AppRelease.entitlements']) assert.match(read(`mobile/ios/App/${f}`), /group\.app\.metablend/)
})

test('the app\'s own texts outside the language packs have no dash: iPhone permission texts and widget catalog, Android strings', () => {
  const found = []
  for (const f of ['mobile/ios/App/App/InfoPlist.xcstrings', 'mobile/ios/App/MetaBlendWidgets/Localizable.xcstrings']) {
    for (const [key, v] of Object.entries(JSON.parse(read(f)).strings)) {
      for (const [lang, l] of Object.entries(v.localizations ?? {})) {
        const s = l.stringUnit?.value ?? ''
        if (/[–—]/.test(s)) found.push(`${f} ${key} ${lang}: ${s}`)
      }
    }
  }
  const plist = read('mobile/ios/App/App/Info.plist')
  for (const m of plist.matchAll(/<key>(NS\w+UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g)) if (/[–—]/.test(m[2])) found.push(`Info.plist ${m[1]}: ${m[2]}`)
  const res = new URL('mobile/android/app/src/main/res/', root)
  for (const dir of fs.readdirSync(res).filter(d => d.startsWith('values'))) {
    const f = new URL(`${dir}/strings.xml`, res)
    if (!fs.existsSync(f)) continue
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/<string name="(\w+)">([^<]*)<\/string>/g)) if (/[–—]/.test(m[2])) found.push(`${dir}/strings.xml ${m[1]}: ${m[2]}`)
  }
  assert.deepEqual(found, [])
})

test('Android draws edge to edge: transparent system bars on every Android version, the app background behind them in both themes', () => {
  // Android 15+ forces edge to edge; Android 14 and older (the A52) kept grey bars and padded the page twice (owner, 2026-11-22)
  const activity = read('mobile/android/app/src/main/java/app/metablend/MainActivity.java')
  assert.match(activity, /EdgeToEdge\.enable\(this, SystemBarStyle\.dark\(Color\.TRANSPARENT\), SystemBarStyle\.dark\(Color\.TRANSPARENT\)\);/)
  // after super.onCreate: BridgeActivity sets the no-action-bar theme there; earlier, the window is built with the splash theme and shows an action bar
  assert.ok(activity.indexOf('super.onCreate') < activity.indexOf('EdgeToEdge.enable'))
  const color = (p, name) => read(p).match(new RegExp(`<color name="${name}">(#[0-9a-fA-F]+)</color>`))?.[1]?.toLowerCase()
  // source-match-ok: the theme colours are read from the layout's viewport config, a JSX file node cannot import, to compare with the Android resources
  const layout = read('app/layout.js')
  const theme = media => layout.match(new RegExp(`prefers-color-scheme: ${media}[)]', color: '(#[0-9a-fA-F]+)'`))[1]
  assert.equal(color('mobile/android/app/src/main/res/values/colors.xml', 'app_background'), theme('light'))
  assert.equal(color('mobile/android/app/src/main/res/values-night/colors.xml', 'app_background'), theme('dark'))
  assert.match(read('mobile/android/app/src/main/res/values/styles.xml'), /name="AppTheme\.NoActionBar"[^]*?<item name="android:windowBackground">@color\/app_background<\/item>[^]*?<\/style>/)
})

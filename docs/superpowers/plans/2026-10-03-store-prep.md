# Store Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything in the repo that TestFlight and a Google Play closed test need — listings in 13 languages, captioned screenshots, compliance answers, release signing, iPhone-only, the owner's checklist.

**Architecture:** One locale table (`store/locales.js`) drives the fastlane metadata folders, the screenshot script and a store test. Screenshots come from a local production build rendered in headless Edge, then wrapped in a caption template, per language and device size.

**Tech Stack:** Node (`node:test`), headless Edge over the DevTools protocol, fastlane folder layout, Gradle, Xcode project files.

**Spec:** `docs/superpowers/specs/2026-10-03-store-prep-design.md`

## Global Constraints

- iOS locales: `en-US`, `de-DE`, `fr-FR`, `es-ES`, `it`, `nl-NL`, `pl`, `cs`, `pt-BR`, `ja`, `zh-Hans`, `ko` (no Slovenian).
- Android locales: `en-US`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `nl-NL`, `pl-PL`, `cs-CZ`, `sl`, `pt-BR`, `ja-JP`, `zh-CN`, `ko-KR`.
- Limits: iOS name 30, subtitle 30, promotional_text 170, description 4000, keywords 100; Android title 30, short_description 80, full_description 4000, changelog 500.
- URLs: privacy https://metablend.app/privacy, support and marketing https://metablend.app; feedback email info@metablend.app.
- Sizes: iPhone 1290 × 2796, Android phone 1080 × 1920, feature graphic 1024 × 500, Play icon 512 × 512.
- Signing secrets never in git (`keystore.properties`, `*.jks`, `*.keystore` ignored).
- Commit and push straight to `main`.

**Plan ruling (writing-plans deviation):** listing texts, caption translations, the compliance sheet and the owner checklist are generated content; this plan gives their English source, rules and limits, and the store test defines "done" (same ruling as the more-languages plan).

## Review Focus

- A translated text over its store limit is rejected at upload — the store test checks every limit (Task 1).
- A screenshot at the wrong pixel size is rejected — the script checks each PNG's size (Task 2).
- The cookie banner or a loader caught on a screenshot — the script sets the consent cookie and waits for content (Task 2).
- A keystore committed by accident — `.gitignore` test (Task 3).
- An unsigned or wrongly signed AAB when `keystore.properties` is missing — release build falls back to unsigned, as today (Task 3).

---

### Task 1: Locale table and listing texts

**Files:**
- Create: `store/locales.js`, `store/store.test.js`, `fastlane/metadata/<ios-locale>/*.txt` (12 locales), `fastlane/metadata/android/<android-locale>/*.txt` (13), `fastlane/metadata/review/{beta_description,what_to_test,feedback_email}.txt`

**Interfaces:**
- Produces: `LOCALES: [{ lang, ios: string|null, android: string }]` (13 rows, app language → store locales).

- [ ] **Step 1: Failing test** — create `store/store.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { LOCALES } from './locales.js'

const root = new URL('../', import.meta.url)
const read = p => fs.readFileSync(new URL(p, root), 'utf8').trim()
const len = s => [...s].length
const IOS = { 'name.txt': 30, 'subtitle.txt': 30, 'promotional_text.txt': 170, 'description.txt': 4000, 'keywords.txt': 100, 'release_notes.txt': 4000 }
const ANDROID = { 'title.txt': 30, 'short_description.txt': 80, 'full_description.txt': 4000, 'changelogs/1.txt': 500 }
const URLS = { 'privacy_url.txt': 'https://metablend.app/privacy', 'support_url.txt': 'https://metablend.app', 'marketing_url.txt': 'https://metablend.app' }
const JUNK = /TODO|TBD|lorem|\{\w+\}/i

test('locales — 13 app languages, iOS without Slovenian', () => {
  assert.deepEqual(LOCALES.map(l => l.lang), ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko'])
  assert.deepEqual(LOCALES.filter(l => l.ios).map(l => l.ios), ['en-US', 'de-DE', 'fr-FR', 'es-ES', 'it', 'nl-NL', 'pl', 'cs', 'pt-BR', 'ja', 'zh-Hans', 'ko'])
  assert.deepEqual(LOCALES.map(l => l.android), ['en-US', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'nl-NL', 'pl-PL', 'cs-CZ', 'sl', 'pt-BR', 'ja-JP', 'zh-CN', 'ko-KR'])
})

test('App Store texts — every locale, every file, within its limit', () => {
  for (const { ios } of LOCALES.filter(l => l.ios)) {
    for (const [file, max] of Object.entries(IOS)) {
      const s = read(`fastlane/metadata/${ios}/${file}`)
      assert.ok(s && len(s) <= max, `${ios}/${file}: ${len(s)} > ${max}`)
      assert.doesNotMatch(s, JUNK, `${ios}/${file}`)
    }
    for (const [file, url] of Object.entries(URLS)) assert.equal(read(`fastlane/metadata/${ios}/${file}`), url)
    assert.doesNotMatch(read(`fastlane/metadata/${ios}/keywords.txt`), /, /, `${ios} keywords: no space after commas`)
  }
})

test('Play texts — every locale, every file, within its limit', () => {
  for (const { android } of LOCALES) {
    for (const [file, max] of Object.entries(ANDROID)) {
      const s = read(`fastlane/metadata/android/${android}/${file}`)
      assert.ok(s && len(s) <= max, `${android}/${file}: ${len(s)} > ${max}`)
      assert.doesNotMatch(s, JUNK, `${android}/${file}`)
    }
  }
})

test('TestFlight review texts exist', () => {
  assert.equal(read('fastlane/metadata/review/feedback_email.txt'), 'info@metablend.app')
  for (const f of ['beta_description.txt', 'what_to_test.txt']) assert.ok(len(read(`fastlane/metadata/review/${f}`)) > 50, f)
})
```

- [ ] **Step 2: Run** `node --test store/store.test.js` → FAIL (no `locales.js`).

- [ ] **Step 3: Locale table** — create `store/locales.js`:

```js
// App language → store locales (fastlane folder names). App Store Connect
// has no Slovenian listing, so Slovenian iPhone users see the English one.
export const LOCALES = [
  { lang: 'en', ios: 'en-US', android: 'en-US' },
  { lang: 'de', ios: 'de-DE', android: 'de-DE' },
  { lang: 'fr', ios: 'fr-FR', android: 'fr-FR' },
  { lang: 'es', ios: 'es-ES', android: 'es-ES' },
  { lang: 'it', ios: 'it', android: 'it-IT' },
  { lang: 'nl', ios: 'nl-NL', android: 'nl-NL' },
  { lang: 'pl', ios: 'pl', android: 'pl-PL' },
  { lang: 'cs', ios: 'cs', android: 'cs-CZ' },
  { lang: 'sl', ios: null, android: 'sl' },
  { lang: 'pt', ios: 'pt-BR', android: 'pt-BR' },
  { lang: 'ja', ios: 'ja', android: 'ja-JP' },
  { lang: 'zh', ios: 'zh-Hans', android: 'zh-CN' },
  { lang: 'ko', ios: 'ko', android: 'ko-KR' },
]
```

- [ ] **Step 4: English texts** — write `fastlane/metadata/en-US/`:
  - `name.txt`: `MetaBlend`
  - `subtitle.txt`: `Weather from 16 sources`
  - `promotional_text.txt`: `One forecast blended from up to 16 weather sources — plus summit forecasts, routes and the safe time to be on top.`
  - `keywords.txt`: `weather,forecast,consensus,mountain,hiking,summit,radar,rain,alerts,widget,ECMWF,alps`
  - `description.txt` (paragraphs, plain text): what MetaBlend is (no single weather model gets every day right; it compares up to 16 sources — ECMWF, GFS, ICON, MET Norway, NWS and more — and blends them into one forecast, weighted by how often each source was right in your region, checked against airport measurements); the outlook (today, tomorrow, the week, hour by hour, how much the sources agree, best time outside, rain radar); hiking (summit forecasts for any peak — wind on top, freezing level, storm risk, the safe summit window; 200 featured peaks with SAC grades; marked routes and GPX import with a suggested start time); notifications (rain soon, storms, severe weather, heat, morning briefing, hike alerts) and home-screen widgets; 13 languages; no account, free; "a forecast, not a safety guarantee — check official mountain forecasts".
  - `release_notes.txt`: `First release.`
  - the three URL files with the Global Constraints URLs.
  - `fastlane/metadata/android/en-US/`: `title.txt` `MetaBlend: Weather & Summits`, `short_description.txt` `One forecast from 16 weather sources, plus summit forecasts and hiking routes.`, `full_description.txt` (the iOS description), `changelogs/1.txt` `First release.`
  - `fastlane/metadata/review/`: `feedback_email.txt` `info@metablend.app`; `beta_description.txt` (two sentences: what the app is); `what_to_test.txt` (search a city and compare with your weather; Hiking → a peak near you, its summit window, a route's suggested start; turn on notifications and plan a hike; add a widget; switch languages in More).

- [ ] **Step 5: The other languages** — for each other row of `LOCALES`, translate the same files into that language (iOS files only where `ios` is set; Android files for all 13), keeping `name.txt` `MetaBlend`, the URLs, "ECMWF/GFS/ICON/MET Norway/NWS" and "SAC" as they are; Play `title.txt` = `MetaBlend: ` + the language's "Weather & Summits"; keywords in the language (comma separated, no spaces, ≤ 100). Wording follows the app's own texts in `lib/i18n/<lang>.js` (same terms: consensus, summit window …).

- [ ] **Step 6: Run** `node --test store/store.test.js` → PASS; `npm test` → all pass.

- [ ] **Step 7: Commit** — `git add store fastlane && git commit -m "Store listings in 13 languages (fastlane layout) with a limits test"`

### Task 2: Captioned screenshots, feature graphic, Play icon

**Files:**
- Create: `store/captions.json`, `scripts/store-shots.mjs`, outputs under `fastlane/screenshots/<ios-locale>/` and `fastlane/metadata/android/<locale>/images/` (`phoneScreenshots/1..5.png`; `en-US` also `featureGraphic.png`, `icon.png`)
- Modify: `store/store.test.js`

**Interfaces:**
- Consumes: `LOCALES` (Task 1); `t` from `lib/i18n.js`.

- [ ] **Step 1: Failing test** — append to `store/store.test.js`:

```js
test('captions — 5 per app language, short enough for two lines', () => {
  const c = JSON.parse(read('store/captions.json'))
  for (const { lang } of LOCALES) {
    assert.equal(c[lang]?.length, 5, lang)
    for (const s of c[lang]) assert.ok(s && len(s) <= 48, `${lang}: ${s}`)
  }
})
```
Run `node --test store/store.test.js` → FAIL.

- [ ] **Step 2: Captions** — `store/captions.json`, `{ "<lang>": [5 strings] }` for all 13; English:
  `["One forecast from 16 weather sources", "The week ahead, and how sure it is", "200 peaks worldwide, nearest first", "Know when the summit is safe", "Your route, timed against the weather"]`; the others translated (≤ 48 characters each). Run the test → PASS.

- [ ] **Step 3: The script** — create `scripts/store-shots.mjs`:

```js
// Captioned store screenshots from a local production build, every language:
//   npx next build && npx next start -p 3123      (separate terminal)
//   node scripts/store-shots.mjs [lang …]         (default: all 13)
// Writes fastlane/screenshots/<ios>/ (1290×2796) and
// fastlane/metadata/android/<android>/images/phoneScreenshots/ (1080×1920),
// plus the Play feature graphic and icon in en-US.
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCALES } from '../store/locales.js'
import { t } from '../lib/i18n.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE ?? 'http://localhost:3123'
const PORT = 9371
const CAPTIONS = JSON.parse(readFileSync(join(ROOT, 'store/captions.json'), 'utf8'))
const DEVICES = [
  { id: 'ios', w: 430, h: 932, scale: 3, out: l => l.ios && join(ROOT, 'fastlane/screenshots', l.ios) },
  { id: 'android', w: 360, h: 640, scale: 3, out: l => join(ROOT, 'fastlane/metadata/android', l.android, 'images/phoneScreenshots') },
]
const SCREENS = [
  { path: '/?city=Vienna', ready: `document.body.innerText.length > 1500 && !document.documentElement.dataset.localizing` },
  { path: '/?city=Vienna', ready: `document.body.innerText.length > 1500`, tab: 'tabWeek' },
  { path: '/hike', ready: `document.querySelectorAll('details').length > 0 && document.body.innerText.includes(${JSON.stringify('§nearYou')})` },
  { path: '/hike?peak=grossglockner', ready: `document.body.innerText.includes('SAC') && document.querySelectorAll('svg').length > 3` },
  { path: '/hike?peak=grossglockner&route=osm-14622955', ready: `!!document.querySelector('.leaflet-container') && document.body.innerText.includes(':')` },
]
const sleep = ms => new Promise(r => setTimeout(r, ms))

const prof = mkdtempSync(join(tmpdir(), 'storeshots-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40 && !targets; i++) { await sleep(250); targets = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json()).catch(() => null) }
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const until = async (expr, ms = 30000) => { for (let s = 0; s < ms; s += 250) { if (await ev(expr)) return true; await sleep(250) } throw new Error(`timeout: ${expr}`) }
const png = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64')
const sizeOf = buf => [buf.readUInt32BE(16), buf.readUInt32BE(20)]
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

function frame(caption, shot, d) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&display=block" rel="stylesheet">
<style>html,body{margin:0;width:${d.w}px;height:${d.h}px;overflow:hidden}
body{background:linear-gradient(180deg,#0f1b33 0%,#1d3a6b 55%,#3f6fb0 100%);font-family:'Hanken Grotesk',system-ui,sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center}
h1{margin:${Math.round(d.h * 0.07)}px ${Math.round(d.w * 0.08)}px ${Math.round(d.h * 0.035)}px;font-size:${Math.round(d.w * 0.075)}px;line-height:1.15;font-weight:800;text-align:center;letter-spacing:-0.01em}
img{width:${Math.round(d.w * 0.8)}px;border-radius:${Math.round(d.w * 0.06)}px;box-shadow:0 12px 40px rgba(0,0,0,.45)}</style></head>
<body><h1>${caption.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h1><img src="data:image/png;base64,${shot.toString('base64')}"></body></html>`
}

async function render(html, d) {
  await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.scale, mobile: true })
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200)
  const { result } = await send('Page.getFrameTree')
  await send('Page.setDocumentContent', { frameId: result.frameTree.frame.id, html })
  await until(`document.fonts.ready.then(() => document.querySelector('img')?.complete ?? true)`)
  await sleep(300)
  return png()
}

const langs = process.argv.slice(2).length ? process.argv.slice(2) : LOCALES.map(l => l.lang)
await send('Network.setCookie', { name: 'metablend_app', value: '1', url: BASE })
await send('Network.setCookie', { name: 'metablend_consent', value: '1', url: BASE })
for (const l of LOCALES.filter(x => langs.includes(x.lang))) {
  await send('Network.setCookie', { name: 'metablend_lang', value: l.lang, url: BASE })
  for (const d of DEVICES) {
    const dir = d.out(l)
    if (!dir) continue
    mkdirSync(dir, { recursive: true })
    for (const [i, s] of SCREENS.entries()) {
      await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.scale, mobile: true })
      await send('Page.navigate', { url: BASE + s.path })
      await until(s.ready.replace('§nearYou', t(l.lang, 'hikeNearYou')))
      if (s.tab) {
        await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(t(l.lang, s.tab))})?.click()`)
        await sleep(1200)
      }
      await sleep(1500)
      const shot = await png()
      const out = await render(frame(CAPTIONS[l.lang][i], shot, d), d)
      const [w, h] = sizeOf(out)
      if (w !== d.w * d.scale || h !== d.h * d.scale) throw new Error(`${l.lang} ${d.id} ${i + 1}: ${w}×${h}`)
      writeFileSync(join(dir, `${i + 1}.png`), out)
      console.log(`${l.lang} ${d.id} ${i + 1} ✓`)
    }
  }
}

// Play feature graphic (1024×500) and icon (512×512), English listing only
if (langs.includes('en')) {
  const img = join(ROOT, 'fastlane/metadata/android/en-US/images')
  mkdirSync(img, { recursive: true })
  const icon = readFileSync(join(ROOT, 'public/icon-512.png'))
  const fg = { w: 1024, h: 500, scale: 1 }
  const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&display=block" rel="stylesheet">
<style>html,body{margin:0;width:1024px;height:500px;overflow:hidden}body{background:linear-gradient(120deg,#0f1b33,#1d3a6b 60%,#3f6fb0);display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;font-family:'Hanken Grotesk',system-ui,sans-serif;color:#fff}
img{width:220px;height:220px;border-radius:48px}h1{font-size:64px;line-height:1.05;margin:0 0 16px;font-weight:800}p{font-size:30px;margin:0;color:#ffd98a;font-weight:700}</style></head>
<body><img src="data:image/png;base64,${icon.toString('base64')}"><div><h1>MetaBlend</h1><p>${t('en', 'welcomeTitle')}</p></div></body></html>`
  const out = await render(html, fg)
  if (sizeOf(out).join('×') !== '1024×500') throw new Error('feature graphic size')
  writeFileSync(join(img, 'featureGraphic.png'), out)
  copyFileSync(join(ROOT, 'public/icon-512.png'), join(img, 'icon.png'))
  console.log('feature graphic + icon ✓')
}
ws.close(); edge.kill(); process.exit(0)
```

- [ ] **Step 4: Run it** — `npx next build`, start `npx next start -p 3123` in the background, `node scripts/store-shots.mjs en` → 5 iOS + 5 Android + feature graphic + icon, each `✓`. Read `fastlane/screenshots/en-US/1.png`, `4.png`, `fastlane/metadata/android/en-US/images/phoneScreenshots/5.png` and `featureGraphic.png` (screenshots must show content, no loader, no cookie banner; caption fits). Fix SCREENS readiness or the route id (`osm-14622955` = 712 Alter Kalser Weg; confirm with `/api/routes` for Großglockner) if a shot is wrong. Then `node scripts/store-shots.mjs` for all languages; read one Japanese and one Polish shot. Stop the server.

- [ ] **Step 5: Commit** — `git add store/captions.json store/store.test.js scripts/store-shots.mjs fastlane && git commit -m "Captioned store screenshots in 13 languages, Play feature graphic and icon"`

### Task 3: Compliance answers and project settings

**Files:**
- Create: `store/compliance.md`
- Modify: `mobile/ios/App/App/Info.plist`, `mobile/ios/App/App.xcodeproj/project.pbxproj` (4 × `TARGETED_DEVICE_FAMILY`), `mobile/android/app/build.gradle`, `mobile/android/.gitignore`, `store/store.test.js`

- [ ] **Step 1: Failing test** — append to `store/store.test.js`:

```js
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
```
Run → FAIL.

- [ ] **Step 2: iOS** — in `Info.plist` add after the first `<dict>`:

```xml
	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
```
and in `project.pbxproj` replace all four `TARGETED_DEVICE_FAMILY = "1,2";` with `TARGETED_DEVICE_FAMILY = 1;`.

- [ ] **Step 3: Android** — in `mobile/android/app/build.gradle` add before `android {`:

```groovy
// Release signing from mobile/android/keystore.properties (never in git):
// storeFile, storePassword, keyAlias, keyPassword. Without the file the
// release build stays unsigned, as before.
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
```
inside `android {` before `buildTypes {`:

```groovy
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile rootProject.file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
```
and in `buildTypes { release {` add `if (keystorePropertiesFile.exists()) signingConfig signingConfigs.release`. Append `keystore.properties`, `*.jks`, `*.keystore` (one per line) to `mobile/android/.gitignore`.

- [ ] **Step 4: Compliance sheet** — write `store/compliance.md` with the seven sections the test names, each a copy-paste answer list matching `app/privacy/content.jsx` (English):
  - App Store — App Privacy: Data Used to Track You: none. Data Not Linked to You: Location → Coarse Location (App Functionality: peak search near you, rounded to ~10 km); Identifiers → Device ID (App Functionality: push token, only when notifications are on); User Content → Other User Content (App Functionality: weather feedback — city, temperature, condition); Usage Data → Product Interaction (Analytics: Plausible, cookieless, aggregate); Diagnostics → Performance Data (Analytics: Vercel Speed Insights). Precise location: not collected (the reverse-geocoding call goes from the phone to BigDataCloud, nothing stored).
  - Google Play — Data safety: Collects: Location (approximate), Device or other IDs, App activity (other user-generated content, app interactions), App info and performance (diagnostics). Purposes: app functionality, analytics. Shared: no (service providers only). Encrypted in transit: yes. Deletion: users can request it (email / GitHub issue; turning notifications off deletes the push record). No account.
  - Content rating (IARC): category Utility/Weather; violence, sexuality, language, controlled substances, gambling: none; user interaction / sharing location / purchases: none → Everyone / PEGI 3 / 4+.
  - Export compliance: uses only standard encryption (HTTPS/TLS by the OS) → exempt; `ITSAppUsesNonExemptEncryption = NO` already in Info.plist.
  - Target audience: 13 and over (not designed for children).
  - Ads: no ads.
  - App access: all features available without login.

- [ ] **Step 5: Run** `node --test store/store.test.js` → PASS; `npm test` → all pass.

- [ ] **Step 6: Commit** — `git add store mobile && git commit -m "Store compliance answers; iPhone only; no encryption question; Android release signing from an ignored file"`

### Task 4: Owner checklist and ship

**Files:**
- Modify: `mobile/README.md`, `CHANGELOG.md`

- [ ] **Step 1: Checklist** — append to `mobile/README.md` a "## Store release (testers first)" section:
  - **Google Play**: sign up at play.google.com/console ($25, ID check, personal account) → Create app (MetaBlend, app, free) → signing key: `keytool -genkeypair -v -keystore metablend-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload` in `mobile/android/` → `mobile/android/keystore.properties` with `storeFile=metablend-upload.jks`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…` (keep a backup of both outside the repo) → Android Studio: Build → Generate Signed App Bundle → release → `.aab` → Testing → Closed testing → create track, upload, add testers (12+ Google accounts or a Google Group) → Store listing: paste from `fastlane/metadata/android/<locale>/`, upload `images/` → App content: Data safety, content rating, target audience, ads, app access from `store/compliance.md`; privacy policy https://metablend.app/privacy → send for review → share the opt-in link → after 14 days with 12+ testers: Apply for production.
  - **Apple**: App Store Connect → Apps → + → iOS, name MetaBlend (if taken: "MetaBlend Weather"), bundle `app.metablend`, SKU `metablend` → Xcode: Product → Archive → Distribute → App Store Connect → TestFlight: internal testers at once; external testers: Test Information from `fastlane/metadata/review/`, beta review → for the public release later: listing from `fastlane/metadata/<locale>/`, screenshots from `fastlane/screenshots/<locale>/`, App Privacy from `store/compliance.md`.
  - **Every later update**: raise `versionCode` + `versionName` (`mobile/android/app/build.gradle`) and Version + Build (Xcode target → General); regenerate screenshots with `node scripts/store-shots.mjs` when screens change.

- [ ] **Step 2: CHANGELOG** — add under `## 2026-10-03`:

```markdown
### Added — store prep
- Store listings in 13 languages (App Store: 12 — no Slovenian there) in the
  fastlane layout, captioned screenshots for iPhone and Android made by
  `scripts/store-shots.mjs`, the Play feature graphic, and copy-paste answers
  for Apple's App Privacy, Google's Data safety, content rating and export
  compliance (`store/compliance.md`).
- iPhone only (iPads run the iPhone version); no export-compliance question
  per build; Android release signing from a git-ignored key file.
- `mobile/README.md`: the steps to TestFlight and a Google Play closed test.
```

- [ ] **Step 3: Verify + push** — `npm test`, `npx eslint app lib scripts --max-warnings 0`, `npx next build` → clean; commit `"Store release checklist; changelog"`; `git push origin main`.

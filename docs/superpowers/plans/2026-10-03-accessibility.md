# Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Larger Text, VoiceOver/TalkBack, Sufficient Contrast and Differentiate Without Color Alone true for MetaBlend's common tasks, with an automated axe check that keeps them true.

**Architecture:** `scripts/a11y-check.mjs` runs axe-core in headless Edge over the main pages in both themes and the extreme sky variants and fails on serious/critical violations; contrast is fixed in the theme colour tokens. Spoken summaries come from a pure, tested `lib/a11y-text.js`. A native `TextScale` plugin (iOS + Android) reports the phone's text size; `lib/text-scale.js` sets the root font size from it inside the app.

**Tech Stack:** Next.js 16, React, Tailwind v4, axe-core (dev dependency), Capacitor 8 plugins (Swift, Java), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-03-accessibility-design.md`

## Global Constraints

- Targets: Larger Text, VoiceOver (+TalkBack), Sufficient Contrast, Differentiate Without Color Alone; Dark Interface and Reduced Motion stay as they are.
- Text scale inside the app: 1–2, rounded to 0.05; root `font-size = 16 × scale px`; nothing set at 1 or on the website.
- No root font-size in px on the website.
- Contrast fixes in theme tokens (`app/globals.css`), not per element; WCAG AA (4.5:1 normal text, 3:1 large text ≥ 18.66px bold / 24px).
- New texts in all 13 languages (parity test).
- Commit and push straight to `main`; CHANGELOG entry when it ships.

**Baseline (axe, 2026-10-03, 5 pages × dark/light):** 138 `color-contrast` (sky muted text `rgb(226 234 247 / .62)` → #96b3d8/#b7cbe6 on light skies; light-theme accent `#2350c8` on light glass 3.24:1; tiny amber/yellow `text-[10px]` split labels ≈ 4.15), 4 `button-name` (share / embed icon buttons on phones), 4 `scrollable-region-focusable` (hour strips).

**Plan ruling:** the "dark" theme is the living sky, whose background changes with weather and time; the check forces the brightest dark-theme skies (`day`, `snow`, `dawn`) plus `night`, and light `day` / `snow`, so contrast holds on every sky, not just today's.

## Review Focus

- A sky variant not in the check with a brighter gradient (e.g. `dusk`): its lightest stop must stay below `day`/`snow`/`dawn` in luminance — verified in Task 2 by computing the stops.
- Text scale 2 on a 390 px phone: hour cards, tab bar, chips and peak rows must grow or wrap, never clip — screenshots in Task 6.
- The plugin missing (older installed app): `TextScale.get` rejects → nothing changes, no error — test in Task 6.
- Hour cards read as one VoiceOver item — but the strip itself must still be scrollable by swipe and reachable by keyboard (`tabIndex=0`, named region) — Task 3.
- Translated summaries with numbers/units in other languages (°F, decimal commas) — summaries reuse the page's own formatters; test in Task 4.

---

### Task 1: The checker (`npm run a11y`)

**Files:**
- Create: `scripts/a11y-check.mjs`
- Modify: `package.json` (devDependency `axe-core`, script `a11y`)

**Interfaces:**
- Produces: `npm run a11y` (needs `npx next start -p 3123` running; `BASE` env overrides) → prints violations per page/variant, exit 1 on any serious/critical, exit 0 when clean.

- [ ] **Step 1: Install** — `npm i -D axe-core` (exact version saved by npm).

- [ ] **Step 2: Create `scripts/a11y-check.mjs`:**

```js
// Accessibility check: axe-core over the main pages in both themes and the
// brightest / darkest skies; exit 1 on any serious or critical violation.
//   npx next build && npx next start -p 3123     (separate terminal)
//   npm run a11y
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.BASE ?? 'http://localhost:3123'
const PORT = 9377
const PAGES = [
  ['/?city=Vienna', null],
  ['/?city=Vienna', 'Week'],
  ['/hike?app=1', null],
  ['/hike?peak=grossglockner&app=1', null],
  ['/more?app=1', null],
  ['/testers', null],
  ['/', null],
]
// [theme cookie, forced sky] — the dark theme is the living sky: check its brightest skies
const VARIANTS = [['dark', 'day'], ['dark', 'snow'], ['dark', 'dawn'], ['dark', 'night'], ['light', 'day'], ['light', 'snow']]
const sleep = ms => new Promise(r => setTimeout(r, ms))

const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'a11y-'))}`, 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40 && !targets; i++) { await sleep(250); targets = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json()).catch(() => null) }
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Network.setCookie', { name: 'metablend_consent', value: '1', url: BASE })
await send('Network.setCookie', { name: 'metablend_lang', value: 'en', url: BASE })

let bad = 0
for (const [theme, sky] of VARIANTS) {
  await send('Network.setCookie', { name: 'metablend_theme', value: theme, url: BASE })
  for (const [path, tab] of PAGES) {
    await send('Page.navigate', { url: BASE + path })
    await sleep(4500)
    if (tab) { await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(tab)})?.click()`); await sleep(1200) }
    // pin the sky so the check covers that background whatever today's weather is
    await ev(`(() => { const h = document.documentElement; h.dataset.sky = ${JSON.stringify(sky)}; new MutationObserver(() => { if (h.dataset.sky !== ${JSON.stringify(sky)}) h.dataset.sky = ${JSON.stringify(sky)} }).observe(h, { attributes: true, attributeFilter: ['data-sky'] }) })()`)
    await sleep(300)
    await ev(AXE)
    const v = await ev(`axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => ({ id: x.id, nodes: x.nodes.map(n => n.target.join(' ') + ' — ' + (n.any[0]?.message ?? '').slice(0, 110)) })))`)
    const n = v.reduce((s, x) => s + x.nodes.length, 0)
    bad += n
    console.log(`${n ? '✗' : '✓'} ${theme}/${sky} ${path}${tab ? ` [${tab}]` : ''}${n ? `: ${n}` : ''}`)
    for (const x of v) for (const node of x.nodes.slice(0, 3)) console.log(`    ${x.id}: ${node}`)
  }
}
ws.close(); edge.kill()
console.log(bad ? `\n${bad} serious/critical violations` : '\nNo serious or critical violations')
process.exit(bad ? 1 : 0)
```

- [ ] **Step 3: Script** — in `package.json` `scripts` add `"a11y": "node scripts/a11y-check.mjs"`.

- [ ] **Step 4: Baseline (RED)** — `npx next build`, `npx next start -p 3123` (background), `npm run a11y` → exit 1 with the color-contrast / button-name / scrollable-region findings; save the output to the workspace as `a11y-baseline.txt`.

- [ ] **Step 5: Commit** — `git add scripts/a11y-check.mjs package.json package-lock.json && git commit -m "a11y: axe check over the main pages, both themes and the extreme skies (npm run a11y)"`

### Task 2: Contrast in the theme tokens

**Files:**
- Modify: `app/globals.css` (theme variables and their `.text-zinc-*` mappings)

**Interfaces:**
- Consumes: `npm run a11y` (Task 1).

- [ ] **Step 1: Find the tokens** — from the baseline, map every distinct failing foreground colour to the CSS variable or mapping that produces it (`grep -n` the hex / rgba in `app/globals.css`). Expected: sky `--muted` (`rgb(226 234 247 / 0.62)`) and any other semi-transparent sky text colours; light-sky `--accent` (`#2350c8`) and `--muted` (`rgb(15 27 51 / 0.66)`); the amber/yellow `--warn` used by small split labels; light-paper `--muted` (`#5d635d`) if flagged.

- [ ] **Step 2: Fix each token once** — raise the alpha / darken or lighten just enough for 4.5:1 against the worst background in its theme (dark: the `day`/`snow`/`dawn` light stops; light: white glass on `day`/`snow`). Keep the hue (same family, so the look stays): e.g. sky `--muted` alpha 0.62 → about 0.82; light-sky `--accent` `#2350c8` → about `#1c3f9e`; small `--warn` text on sky → the lighter amber already used for large text, or bold. Note each before → after value and its ratio in the ledger.

- [ ] **Step 3: Check other skies** — compute the luminance of each `--sky-c` stop in both themes (node one-liner using the WCAG formula) and confirm the checked variants (`day`, `snow`, `dawn` / light `day`, `snow`) are the brightest; if `dusk` or another is brighter, add it to `VARIANTS` in the check.

- [ ] **Step 4: Verify** — rebuild, restart, `npm run a11y` → no `color-contrast` lines (other rule ids may remain for Task 3). Screenshot `/?city=Vienna` dark/day and light/day at 390 px and read them: the look is unchanged except slightly stronger small text.

- [ ] **Step 5: Commit** — `git add app/globals.css && git commit -m "a11y: theme colours meet AA contrast on every sky and the light theme"`

### Task 3: Names, regions, focus

**Files:**
- Modify: `app/page.js` (share / embed buttons), `app/components/ScrollStrip.jsx`, `HourStrip.jsx`, `SummitStrip.jsx` and their callers (`lang` prop), any further component axe flags for `button-name` / `link-name` / `aria-*` (existing translated keys first; a new key only if none fits, in all 13 languages)

**Interfaces:**
- Consumes: `npm run a11y`.
- Produces: `<ScrollStrip label>` — a named, focusable scroll region.

- [ ] **Step 1: Share / embed** — on the two icon buttons in `app/page.js` (the `Share2` and `Code2` ones) add `aria-label={t(lang, 'shareBtn')}` and `aria-label={t(lang, 'embedBtn')}` (the visible text is hidden on phones).

- [ ] **Step 2: Scroll regions** — `ScrollStrip({ children, label })`: the scrolling `div` gets `tabIndex={0}`, `role="region"`, `aria-label={label}`; `HourStrip` and `SummitStrip` pass `label={t(lang, 'hourByHour')}` (they receive `lang` — add the prop where missing and pass it from `TabToday`, `TabTomorrow`, `PeakView`). Keyboard: the arrow keys scroll a focused region natively.

- [ ] **Step 3: Anything else** — rerun `npm run a11y`; every remaining non-contrast serious/critical rule gets the matching fix (a translated `aria-label` from existing keys where possible; a new key otherwise, added in all 13 languages).

- [ ] **Step 4: Verify** — `npm test`, `npx eslint app lib --max-warnings 0`, rebuild, `npm run a11y` → exit 0.

- [ ] **Step 5: Commit** — `git add app lib && git commit -m "a11y: named buttons and scroll regions"`

### Task 4: Spoken summaries (`lib/a11y-text.js`)

**Files:**
- Create: `lib/a11y-text.js`, `lib/a11y-text.test.js`
- Modify: `app/components/outlook/HourlyChart.jsx`, `HourStrip.jsx`, `app/components/hike/SummitStrip.jsx`, `app/components/outlook/Tab7d.jsx` (agreement), `app/components/outlook/NowcastCard.jsx`, `app/leaderboard/page.js` (sparkline), `lib/i18n/*.js` (13)

**Interfaces:**
- Produces: `chartSummary(lang, hours, fmtTemp) → string`, `hourLabel(lang, h, fmtTemp) → string`, `summitHourLabel(lang, h, fmtTemp) → string`, `A11Y_KEYS`.

- [ ] **Step 1: Failing tests** — create `lib/a11y-text.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chartSummary, hourLabel, summitHourLabel, A11Y_KEYS } from './a11y-text.js'
import { tempFormatter } from './outlook/text.js'
import { t } from './i18n.js'

const C = tempFormatter('C'), F = tempFormatter('F')
const hours = [
  { t: '2026-10-03T03:00', temp: 11, rainPct: 5 },
  { t: '2026-10-03T09:00', temp: 18, rainPct: 0 },
  { t: '2026-10-03T15:00', temp: 24, rainPct: 10 },
  { t: '2026-10-03T21:00', temp: 16, rainPct: 40 },
]

test('chartSummary — lowest and highest with their times, highest rain chance', () => {
  assert.equal(chartSummary('en', hours, C), `From ${C(11)} at 03:00 to ${C(24)} at 15:00, rain chance up to 40%`)
  assert.match(chartSummary('en', hours, F), /°F|°/)
  assert.equal(chartSummary('en', [], C), '')
})

test('hourLabel / summitHourLabel — one sentence per hour card', () => {
  assert.equal(hourLabel('en', hours[2], C), `15:00, ${C(24)}, rain 10%`)
  assert.equal(hourLabel('en', { ...hours[2], rainPct: null }, C), `15:00, ${C(24)}`)
  const s = summitHourLabel('en', { t: '2026-10-03T15:00', temp: -3, rainPct: 0, windKmh: 25, freezingLevel: 3100, storm: 'moderate' }, C)
  assert.equal(s, `15:00, ${C(-3)}, rain 0%, wind 25 km/h, freezing level 3100 m, storm risk moderate`)
})

test('every a11y text exists (English; parity covers the rest)', () => {
  for (const k of A11Y_KEYS) assert.notEqual(t('en', k), k, k)
})
```
Run `node --test lib/a11y-text.test.js` → FAIL.

- [ ] **Step 2: Implement** — create `lib/a11y-text.js`:

```js
// What VoiceOver / TalkBack read for things the eye takes in at a glance:
// a chart's range, an hour card, a summit hour. Uses the page's own
// formatters so units and decimals match what is on screen.
import { t } from './i18n.js'
import { fill } from './outlook/text.js'

export const A11Y_KEYS = ['a11yChart', 'a11yRain', 'a11yWind', 'a11yFreezing', 'a11yStorm']
const hh = iso => iso.slice(11, 16)
const tr = (lang, key, vars) => fill(t(lang, key), vars)

export function chartSummary(lang, hours, fmtTemp) {
  const valid = (hours ?? []).filter(h => typeof h.temp === 'number')
  if (!valid.length) return ''
  const lo = valid.reduce((a, b) => (b.temp < a.temp ? b : a)), hi = valid.reduce((a, b) => (b.temp > a.temp ? b : a))
  const rain = Math.max(0, ...valid.map(h => h.rainPct ?? 0))
  return tr(lang, 'a11yChart', { min: fmtTemp(lo.temp), minAt: hh(lo.t), max: fmtTemp(hi.temp), maxAt: hh(hi.t), rain })
}

export function hourLabel(lang, h, fmtTemp) {
  return [hh(h.t), fmtTemp(h.temp), h.rainPct != null ? tr(lang, 'a11yRain', { pct: h.rainPct }) : null].filter(Boolean).join(', ')
}

export function summitHourLabel(lang, h, fmtTemp) {
  return [
    hourLabel(lang, h, fmtTemp),
    h.windKmh != null ? tr(lang, 'a11yWind', { kmh: h.windKmh }) : null,
    h.freezingLevel != null ? tr(lang, 'a11yFreezing', { m: h.freezingLevel }) : null,
    h.storm ? tr(lang, 'a11yStorm', { level: t(lang, `storm${h.storm[0].toUpperCase()}${h.storm.slice(1)}`) }) : null,
  ].filter(Boolean).join(', ')
}
```

- [ ] **Step 3: Texts** — English, added to every `lib/i18n/<code>.js` as an `// accessibility` block (13 languages, same placeholders):

```
a11yChart: 'From {min} at {minAt} to {max} at {maxAt}, rain chance up to {rain}%'
a11yRain: 'rain {pct}%'
a11yWind: 'wind {kmh} km/h'
a11yFreezing: 'freezing level {m} m'
a11yStorm: 'storm risk {level}'
```
Run `node --test lib/a11y-text.test.js lib/i18n/parity.test.js` → PASS.

- [ ] **Step 4: Wire up**
  - `HourlyChart`: the outer `div` (or the `svg`) gets `role="img"` and `aria-label={chartSummary(lang, hours, fmtTemp)}` — it receives `unit`/`lang`; build `fmtTemp` with `tempFormatter(unit)`; inner text nodes stay but the svg gets `aria-hidden` children via `role="img"`.
  - `HourStrip` / `SummitStrip`: each card `div` gets `role="listitem"` (strip inner flex `role="list"`) and `aria-label={hourLabel(...)}` / `summitHourLabel(...)`; the card's inner lines `aria-hidden`.
  - `Tab7d` `Agree`: keep the existing `aria-label`; show hollow dots for the missing ones (`'●'.repeat(level) + '○'.repeat(3 - level)`) so the count reads without colour.
  - `NowcastCard`: the bars row gets `role="img"` + `aria-label` = the sentence; remove its `aria-hidden`.
  - Leaderboard `Sparkline`: `role="img"` + `aria-label` "{n} recent checks: {up} close, {down} off" — use existing `lbRecent` as the label text if a count sentence is not worth a key (ruling at execution).

- [ ] **Step 5: Verify** — `npm test`, lint, rebuild, `npm run a11y` → exit 0.

- [ ] **Step 6: Commit** — `git add lib app && git commit -m "a11y: spoken summaries for charts, hour cards, agreement and rain bars"`

### Task 5: Colour never alone

**Files:**
- Modify: `app/components/hike/SummitStrip.jsx` (storm bar + `StormLegend`)

- [ ] **Step 1: Failing test** — add to `lib/a11y-text.test.js`:

```js
import { stormSegments } from './a11y-text.js'
test('stormSegments — 1 / 2 / 3 filled for low / moderate / high, 0 unknown', () => {
  assert.deepEqual(['low', 'moderate', 'high', null].map(stormSegments), [1, 2, 3, 0])
})
```
(move the import to the top). Run → FAIL.

- [ ] **Step 2: Implement** — in `lib/a11y-text.js`: `export const stormSegments = s => ({ low: 1, moderate: 2, high: 3 }[s] ?? 0)`. In `SummitStrip.jsx` replace the single coloured bar with three small segments (`flex gap-0.5 justify-center mt-1`, each `h-1.5 w-2.5 rounded-full`), the first `stormSegments(h.storm)` filled with `STORM_COLOR[h.storm]`, the rest `var(--muted)` at 0.25 opacity; `StormLegend` shows the same 1/2/3 segment pattern next to each word.

- [ ] **Step 3: Verify** — test PASS; lint; rebuild; peak page screenshot at 390 px read (segments visible, legend matches).

- [ ] **Step 4: Commit** — `git add lib/a11y-text.js lib/a11y-text.test.js app/components/hike/SummitStrip.jsx && git commit -m "a11y: storm risk as 1/2/3 segments, not colour alone"`

### Task 6: Larger Text

**Files:**
- Create: `lib/text-scale.js`, `lib/text-scale.test.js`, `mobile/android/app/src/main/java/app/metablend/TextScalePlugin.java`
- Modify: `mobile/ios/App/App/AppDelegate.swift` (plugin + registration), `mobile/android/app/src/main/java/app/metablend/MainActivity.java` (registration), `app/components/AppChrome.jsx`, the 20 `text-[10px]` / `text-[11px]` uses, fixed text boxes found at 200 %

**Interfaces:**
- Produces: `clampScale(n) → number`, `applyTextScale(scale, root?)`, `watchTextScale() → unsubscribe` (native only); native plugin `TextScale.get() → { scale }`, event `change { scale }`.

- [ ] **Step 1: Failing tests** — create `lib/text-scale.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampScale, applyTextScale } from './text-scale.js'

test('clampScale — 1 to 2, steps of 0.05, junk is 1', () => {
  assert.deepEqual([0.8, 1, 1.12, 1.18, 2.4, NaN, null, '1.3'].map(clampScale), [1, 1, 1.1, 1.2, 2, 1, 1, 1.3])
})

test('applyTextScale — sets the root size above 1, clears it at 1', () => {
  const root = { style: { fontSize: '' } }
  applyTextScale(1.5, root)
  assert.equal(root.style.fontSize, '24px')
  applyTextScale(1, root)
  assert.equal(root.style.fontSize, '')
})
```
Run → FAIL.

- [ ] **Step 2: Implement** — create `lib/text-scale.js`:

```js
// Larger Text in the app: the phone's text-size setting (native TextScale
// plugin) scales the root font size, and with it every rem-based size.
// The website leaves the root alone so the browser's own setting works.
import { isNative } from './native.js'

let plugin = null // Capacitor plugin proxy: kept in a variable, never resolved from a promise (see lib/app-icon.js)

export function clampScale(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 1
  return Math.round(Math.min(2, Math.max(1, v)) * 20) / 20
}

export function applyTextScale(scale, root = globalThis.document?.documentElement) {
  if (!root) return
  const s = clampScale(scale)
  root.style.fontSize = s === 1 ? '' : `${16 * s}px`
}

// reads the setting now and on every change; resolves to an unsubscribe
export async function watchTextScale() {
  if (!isNative()) return () => {}
  try {
    const { registerPlugin } = await import('@capacitor/core')
    plugin ??= registerPlugin('TextScale')
    applyTextScale((await plugin.get()).scale)
    const sub = await plugin.addListener('change', e => applyTextScale(e.scale))
    return () => sub.remove()
  } catch {
    return () => {} // an older app build without the plugin: normal size
  }
}
```
Run the test → PASS.

- [ ] **Step 3: Native**
  - iOS — in `AppDelegate.swift` next to `AppIconPlugin`:

```swift
@objc(TextScalePlugin)
public class TextScalePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TextScalePlugin"
    public let jsName = "TextScale"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)]
    private var observer: NSObjectProtocol?

    private func scale() -> Double { Double(UIFont.preferredFont(forTextStyle: .body).pointSize / 17.0) }

    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self else { return }
            self.notifyListeners("change", data: ["scale": self.scale()])
        }
    }

    @objc func get(_ call: CAPPluginCall) { call.resolve(["scale": scale()]) }
}
```
  and register it: `bridge?.registerPluginInstance(TextScalePlugin())` after the `AppIconPlugin` line.
  - Android — create `TextScalePlugin.java`:

```java
package app.metablend;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The phone's font-size setting for the web view's Larger Text (lib/text-scale.js).
@CapacitorPlugin(name = "TextScale")
public class TextScalePlugin extends Plugin {
    private float last = -1f;

    private float scale() { return getContext().getResources().getConfiguration().fontScale; }

    @PluginMethod
    public void get(PluginCall call) {
        JSObject r = new JSObject();
        r.put("scale", scale());
        call.resolve(r);
    }

    // the setting can change while the app is in the background
    @Override
    protected void handleOnResume() {
        float s = scale();
        if (last >= 0 && s != last) {
            JSObject r = new JSObject();
            r.put("scale", s);
            notifyListeners("change", r);
        }
        last = s;
    }
}
```
  and register `registerPlugin(TextScalePlugin.class);` in `MainActivity` next to the others. Also set the WebView's own text zoom to 100 so Android does not scale text twice: in `MainActivity.onCreate` after `super.onCreate`: `getBridge().getWebView().getSettings().setTextZoom(100);`.

- [ ] **Step 4: Web wiring** — in `AppChrome.jsx`'s app effect add `watchTextScale().then(fn => { if (gone) fn(); else offScale = fn })` with `let offScale = () => {}` and call `offScale()` in the cleanup (the same pattern as `offPush`).

- [ ] **Step 5: rem everywhere text lives** — replace `text-[10px]` → `text-[0.625rem]` and `text-[11px]` → `text-[0.6875rem]` across `app/`; hour cards `w-14` / `w-16` → `min-w-14` / `min-w-16` with `px-1`; check the tab bar and chips use `min-h`/padding rather than fixed `h-*` where they hold text.

- [ ] **Step 6: 200 % check** — headless Edge 390 px with `document.documentElement.style.fontSize = '32px'` on `/?city=Vienna` (today + week), `/hike?app=1`, a peak page, `/more?app=1`: `scrollWidth ≤ 390`, read the screenshots — nothing clipped, rows wrap; fix what breaks with `min-w-0` / `flex-wrap` / `break-words`.

- [ ] **Step 7: Verify + commit** — `npm test`, lint, build, `npm run a11y` → exit 0; `git add lib app mobile && git commit -m "a11y: Larger Text — the app follows the phone's text size (TextScale plugin), rem-based sizes"`

### Task 7: Checklist and ship

**Files:**
- Modify: `mobile/README.md`, `CHANGELOG.md`

- [ ] **Step 1: Checklist** — append to `mobile/README.md`:

```markdown
## Accessibility (before ticking the App Store labels)

New app build needed (Larger Text uses the new TextScale plugin).

- [ ] iPhone: Settings → Accessibility → Display & Text Size → Larger Text → largest size: open MetaBlend — text is larger, nothing cut off on the forecast, a peak page and More; change the size while the app is open → it follows.
- [ ] Android: Settings → Display → Font size → largest: same check (it updates when you return to the app).
- [ ] VoiceOver (iPhone: triple-click the side button if set up, or Settings → Accessibility → VoiceOver): search a city and hear the forecast, the chart summary and an hour card as one sentence; open Hiking → a peak → its summit window and a route; plan a hike; change the language in More. Every button says what it does.
- [ ] TalkBack (Android): the same four tasks.
- [ ] Then App Store Connect → App Accessibility: tick VoiceOver, Larger Text, Dark Interface, Differentiate Without Color Alone, Sufficient Contrast, Reduced Motion (Voice Control if the VoiceOver walk went smoothly).
```

- [ ] **Step 2: CHANGELOG** — under the top date:

```markdown
### Added — accessibility
- **Larger Text** in the app: text follows the phone's text-size setting (up to
  double) and updates live; small labels and hour cards grow with it.
- **VoiceOver / TalkBack**: every button is named; charts, hour cards, the rain
  bars and the agreement dots are read as one sentence each; the hour strips
  are reachable by keyboard.
- **Contrast**: small text on every sky and on the light theme meets WCAG AA.
- Storm risk shows 1 / 2 / 3 segments, not just a colour.
- `npm run a11y` checks the main pages in both themes and the brightest skies.
```

- [ ] **Step 3: Push** — `npm test`, `npx next build`, `npm run a11y` (exit 0), commit `"Accessibility checklist; changelog"`, `git push origin main`.

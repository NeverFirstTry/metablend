# More Languages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MetaBlend in 13 languages (adds nl, pl, cs, sl, pt-BR, ja, zh-Hans, ko) across website, app, notifications, widgets and the privacy page, with a test that no language misses a text.

**Architecture:** `lib/i18n.js` keeps its public interface but reads its table from one module per language in `lib/i18n/`. `tn` chooses plural forms through `Intl.PluralRules`. A parity test pins every language to English's keys and placeholders.

**Tech Stack:** Next.js 16, React, `node:test`, Android resources, Xcode String Catalogs.

**Spec:** `docs/superpowers/specs/2026-10-02-more-languages-design.md`

## Global Constraints

- New codes and picker labels exactly: `nl` Nederlands, `pl` Polski, `cs` Čeština, `sl` Slovenščina, `pt` Português (Brasil), `ja` 日本語, `zh` 中文（简体）, `ko` 한국어.
- `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant*` → English; `pt-PT` → `pt`.
- Every language module has exactly `en.js`'s keys and the same `{placeholders}` per text.
- Each translated privacy page adds: "This is a translation; if versions differ, the English version applies." (translated).
- Not translated: peak names, weather-service names, city names.
- Brazilian Portuguese spelling; Simplified Chinese characters.
- Commit and push straight to `main`; CHANGELOG entry when it ships.

**Plan ruling (writing-plans deviation):** the ~3,000 translated strings and 8 privacy translations are generated content; writing them into this plan and then copying them into files would double the largest part of the work. Tasks 3 and 4 give the rules, glossary and file shapes; the parity, placeholder and coverage tests define "done".

## Glossary (keep these fixed in every language)

- **MetaBlend** — never translated.
- **SAC** grade letters (T1–T6, L, WS, ZS, S) — never translated; fr/it notes may say CAS as today.
- consensus / blend → the language's word for "consensus" (as de "Konsens").
- summit window → "safe time window at the summit" sense (de "Gipfelfenster").
- feels like, gusts, freezing level, thunderstorm risk → standard weather terms of that language (as a national weather service uses them).
- Units stay as symbols: °C, °F, km/h, mm, m, km, %.
- Tone: short, plain, informal "you" where the language has the choice (du / jij / ty / ty / ti / você); polite neutral in ja (です/ます), ko (해요체), zh (no 您 unless a sentence needs it).

## Review Focus

- A missing key in one language shows English mid-screen — parity test (Task 1).
- `{placeholder}` renamed or translated → raw braces on screen — placeholder check (Task 1).
- A Traditional-Chinese phone gets Simplified — `detectLang` test (Task 3).
- Polish / Czech / Slovenian counts read wrong ("5 modele") — plural test (Task 2/3).
- Long words overflow chips and buttons at 390 px — visual check (Task 5).

---

### Task 1: One module per language + parity test

**Files:**
- Create: `lib/i18n/en.js`, `de.js`, `fr.js`, `es.js`, `it.js` (moved, unchanged), `lib/i18n/parity.test.js`
- Modify: `lib/i18n.js` (table → imports)

**Interfaces:**
- Produces: `lib/i18n/<code>.js` → `export default { key: 'text', … }`; `lib/i18n.js` unchanged exports.

- [ ] **Step 1: Failing test** — create `lib/i18n/parity.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES } from '../i18n.js'

const packs = Object.fromEntries(await Promise.all(LANGUAGES.map(async ({ code }) => [code, (await import(`./${code}.js`)).default])))
const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
// plural extras exist only where the language needs them
const PLURAL = /(One|Two|Few|Many)$/

test('every language has exactly the English texts, with the same {placeholders}', () => {
  const en = packs.en
  const base = Object.keys(en).filter(k => !PLURAL.test(k) || k.endsWith('One'))
  for (const { code } of LANGUAGES) {
    const p = packs[code]
    const missing = base.filter(k => !(k in p) && !k.endsWith('One'))
    assert.deepEqual(missing, [], `${code} misses ${missing.join(', ')}`)
    const extra = Object.keys(p).filter(k => !(k in en) && !PLURAL.test(k))
    assert.deepEqual(extra, [], `${code} has unknown ${extra.join(', ')}`)
    for (const k of Object.keys(p)) {
      const ref = en[k] ?? en[k.replace(PLURAL, '')]
      assert.equal(holes(p[k]), holes(ref), `${code}.${k} placeholders`)
    }
  }
})
```

- [ ] **Step 2: Run** `node --test lib/i18n/parity.test.js` → FAIL (no `./en.js`).

- [ ] **Step 3: Split** — with a one-off node script (not committed) cut `lib/i18n.js` lines of each `  <code>: {` … `  },` block into `lib/i18n/<code>.js` as `// <Language> texts — keys and {placeholders} must match en.js (lib/i18n/parity.test.js).\nexport default {\n<block body, dedented by 2>\n}\n`, and replace the `const T = { … }` table in `lib/i18n.js` with:

```js
import en from './i18n/en.js'
import de from './i18n/de.js'
import fr from './i18n/fr.js'
import es from './i18n/es.js'
import it from './i18n/it.js'

// one module per language (lib/i18n/<code>.js); parity.test.js keeps them in step
const T = { en, de, fr, es, it }
```

- [ ] **Step 4: Run** `node --test lib/i18n/parity.test.js` → PASS (fix any real gap it reports in the existing languages); `npm test` → all pass; `npx next build` → clean.

- [ ] **Step 5: Commit** — `git add lib/i18n.js lib/i18n && git commit -m "i18n: one module per language; parity test for keys and placeholders"`

### Task 2: Plural rules

**Files:**
- Modify: `lib/i18n.js` (`tn`), Test: `lib/i18n/plural.test.js` (create)

**Interfaces:**
- Produces: `pluralKey(lang, key, n, has) → string` (exported for tests); `tn` uses it.

- [ ] **Step 1: Failing test** — create `lib/i18n/plural.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pluralKey, tn } from '../i18n.js'

const has = keys => k => keys.includes(k)

test('pluralKey — the language plural category picks the form, else the base key', () => {
  const pl = has(['mOne', 'mFew', 'mMany'])
  assert.deepEqual([1, 2, 4, 5, 12, 22, 25].map(n => pluralKey('pl', 'm', n, pl)), ['mOne', 'mFew', 'mFew', 'mMany', 'mMany', 'mFew', 'mMany'])
  const sl = has(['mOne', 'mTwo', 'mFew'])
  assert.deepEqual([1, 2, 3, 5, 101, 102].map(n => pluralKey('sl', 'm', n, sl)), ['mOne', 'mTwo', 'mFew', 'm', 'mOne', 'mTwo'])
  assert.deepEqual([1, 2, 5].map(n => pluralKey('cs', 'm', n, has(['mOne', 'mFew']))), ['mOne', 'mFew', 'm'])
  assert.equal(pluralKey('ja', 'm', 1, has(['mOne'])), 'm') // no singular in Japanese
  assert.equal(pluralKey('en', 'm', 1, has(['mOne'])), 'mOne')
  assert.equal(pluralKey('en', 'm', 1, has([])), 'm')
})

test('tn — English singular and plural as before', () => {
  assert.equal(tn('en', 'hikeModels', 1), tn('en', 'hikeModelsOne', 1))
  assert.match(tn('en', 'hikeModels', 9), /9/)
})
```

- [ ] **Step 2: Run** `node --test lib/i18n/plural.test.js` → FAIL (`pluralKey` not exported).

- [ ] **Step 3: Implement** — in `lib/i18n.js` replace `tn` with:

```js
const PLURAL_FORM = { one: 'One', two: 'Two', few: 'Few', many: 'Many' }
const pluralRules = {}

// The text for a count: the language's plural category (Intl.PluralRules —
// Polish 2 → few, 5 → many; Slovenian 2 → two) picks key + One/Two/Few/Many
// when the language has that form, else the base key ("other").
export function pluralKey(lang, key, n, has) {
  const rules = (pluralRules[lang] ??= new Intl.PluralRules(lang))
  const form = PLURAL_FORM[rules.select(n)]
  return form && has(key + form) ? key + form : key
}

// A text with a count in it; {n} and any other {vars} filled in.
export function tn(lang, key, n, vars = {}) {
  const pack = T[lang] ?? T.en
  const k = pluralKey(lang in T ? lang : 'en', key, n, f => f in pack)
  const all = { ...vars, n }
  return String(pack[k] ?? T.en[k] ?? T.en[key] ?? k).replace(/\{(\w+)\}/g, (m, v) => (all[v] ?? m))
}
```

- [ ] **Step 4: Run** `node --test lib/i18n/plural.test.js` → PASS; `npm test` → all pass.

- [ ] **Step 5: Commit** — `git add lib/i18n.js lib/i18n/plural.test.js && git commit -m "i18n: plural forms from Intl.PluralRules"`

### Task 3: Eight new language packs

**Files:**
- Create: `lib/i18n/nl.js`, `pl.js`, `cs.js`, `sl.js`, `pt.js`, `ja.js`, `zh.js`, `ko.js`
- Modify: `lib/i18n.js` (`LANGUAGES`, imports, `T`, `detectLang`), `lib/i18n.test.js`, `app/layout.js` (`inLanguage`)

**Interfaces:**
- Consumes: parity test (Task 1), `pluralKey` (Task 2).

- [ ] **Step 1: Failing tests** — append to `lib/i18n.test.js` (import `detectLang`, `LANGUAGES`, `tn` if missing):

```js
test('detectLang — the new languages; Traditional Chinese falls back to English', () => {
  for (const [tag, want] of [['nl-NL', 'nl'], ['pl', 'pl'], ['cs-CZ', 'cs'], ['sl-SI', 'sl'], ['pt-BR', 'pt'], ['pt-PT', 'pt'],
    ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['zh', 'zh'], ['zh-CN', 'zh'], ['zh-Hans-CN', 'zh'], ['zh-SG', 'zh'],
    ['zh-TW', 'en'], ['zh-HK', 'en'], ['zh-MO', 'en'], ['zh-Hant-TW', 'en'], ['zh-TW,zh;q=0.9', 'en']]) {
    assert.equal(detectLang(tag), want, tag)
  }
  assert.deepEqual(LANGUAGES.map(l => l.code), ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'cs', 'sl', 'pt', 'ja', 'zh', 'ko'])
})

test('tn — Polish, Czech and Slovenian counts take their own forms', () => {
  const forms = (lang, ns) => new Set(ns.map(n => tn(lang, 'hikeModels', n).replace(/\d+/g, '#'))).size
  assert.equal(forms('pl', [1, 2, 5]), 3)
  assert.equal(forms('cs', [1, 2, 5]), 3)
  assert.equal(forms('sl', [1, 2, 3, 5]), 4)
})
```

- [ ] **Step 2: Run** `node --test lib/i18n.test.js` → FAIL.

- [ ] **Step 3: Language list and detection** — in `lib/i18n.js` extend `LANGUAGES` with `{ code: 'nl', label: 'Nederlands' }, { code: 'pl', label: 'Polski' }, { code: 'cs', label: 'Čeština' }, { code: 'sl', label: 'Slovenščina' }, { code: 'pt', label: 'Português (Brasil)' }, { code: 'ja', label: '日本語' }, { code: 'zh', label: '中文（简体）' }, { code: 'ko', label: '한국어' }`; import the 8 modules into `T`; replace `detectLang` with:

```js
export function detectLang(navigatorLang) {
  const tag = (navigatorLang ?? '').split(/[,;]/)[0].trim().toLowerCase().replace(/_/g, '-')
  const code = tag.split('-')[0]
  // Simplified Chinese only: Taiwan, Hong Kong, Macau and Hant read Traditional
  if (code === 'zh' && /-(tw|hk|mo|hant)\b/.test(tag)) return 'en'
  return LANGUAGES.find(l => l.code === code)?.code ?? 'en'
}
```

and in `app/layout.js` set `inLanguage: LANGUAGES.map(l => l.code)` (import `LANGUAGES` from `@/lib/i18n`).

- [ ] **Step 4: Translate** — for each of nl, pl, cs, sl, pt, ja, zh, ko create `lib/i18n/<code>.js` with the header comment of Task 1 and every key of `en.js` in the same order, translated per the Glossary. Plural texts: give `hikeModels`-style keys (every key that has a `…One` in `en.js`) the forms the language needs — pl/cs: `…One`, `…Few` and the base (= many/other); sl: `…One`, `…Two`, `…Few` and the base; ja/zh/ko: base only (no `…One`); nl/pt: `…One` + base. Keep `{placeholders}` byte-identical. After each file run `node --test lib/i18n/parity.test.js` (it only checks languages listed in `LANGUAGES`, so add each code to `LANGUAGES`/`T` as its file lands).

- [ ] **Step 5: Run** `node --test lib/i18n.test.js lib/i18n/parity.test.js lib/i18n/plural.test.js` → PASS; `npm test` → all pass.

- [ ] **Step 6: Commit** — `git add lib/i18n.js lib/i18n lib/i18n.test.js app/layout.js && git commit -m "Eight new languages: Dutch, Polish, Czech, Slovenian, Portuguese (Brazil), Japanese, Chinese (Simplified), Korean"`

### Task 4: Privacy page in 13 languages

**Files:**
- Modify: `app/privacy/content.jsx`, Test: `lib/privacy-langs.test.js` (create)

- [ ] **Step 1: Failing test** — create `lib/privacy-langs.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { LANGUAGES } from './i18n.js'

test('the privacy page has a full notice for every language', () => {
  const src = fs.readFileSync(new URL('../app/privacy/content.jsx', import.meta.url), 'utf8')
  for (const { code } of LANGUAGES) assert.match(src, new RegExp(`^  ${code}: \\{$`, 'm'), `privacy ${code}`)
  assert.equal((src.match(/updated: '/g) ?? []).length, LANGUAGES.length)
})
```

- [ ] **Step 2: Run** `node --test lib/privacy-langs.test.js` → FAIL.

- [ ] **Step 3: Translate** — add `nl`, `pl`, `cs`, `sl`, `pt`, `ja`, `zh`, `ko` blocks to `CONTENT` in `app/privacy/content.jsx`, each mirroring the English block section by section (same facts, same links, same list items), with a first paragraph line "This is a translation; if versions differ, the English version applies." in that language. Update the comment "change all five together" to "change all of them together".

- [ ] **Step 4: Run** the test → PASS; `npx next build` → clean.

- [ ] **Step 5: Commit** — `git add app/privacy/content.jsx lib/privacy-langs.test.js && git commit -m "Privacy notice in all 13 languages"`

### Task 5: Phone texts, layout safety, visual check

**Files:**
- Create: `mobile/android/app/src/main/res/values-{nl,pl,cs,sl,pt,ja,zh,ko}/strings.xml` (`zh` as `values-zh-rCN`, plus `values-b+zh+Hans`)
- Modify: `mobile/ios/App/MetaBlendWidgets/Localizable.xcstrings`, `mobile/ios/App/App/InfoPlist.xcstrings`, `mobile/ios/App/App.xcodeproj/project.pbxproj` (`knownRegions`), `app/globals.css`

- [ ] **Step 1: Android** — for each new language a `strings.xml` with the same names as `values-de/strings.xml`, translated (widget names and descriptions). Any other translated strings `values-de` gains later follow the same rule. Chinese: `values-zh-rCN` and `values-b+zh+Hans` (Simplified only; Traditional phones fall back to English `values`).

- [ ] **Step 2: iOS** — with a node script, add `nl`, `pl`, `cs`, `sl`, `pt-BR`, `ja`, `zh-Hans`, `ko` localizations (`{ "stringUnit": { "state": "translated", "value": … } }`) to every key of both `.xcstrings` files; add the same codes to `knownRegions` in `project.pbxproj` (after `it,`). JSON stays valid (`node -e "JSON.parse(...)"` both files).

- [ ] **Step 3: Layout safety** — in `app/globals.css` add:

```css
/* long compounds (Polish, Czech, Dutch) never push a chip or button wider than the phone */
button, a, .truncate, summary { overflow-wrap: anywhere; }
:lang(ja), :lang(zh), :lang(ko) { word-break: normal; line-break: strict; }
```

- [ ] **Step 4: Verify** — `npx eslint app lib --max-warnings 0`, `npm test`, `npx next build` → clean. Local `npx next start -p 3123`; headless Edge 390 px with cookie `metablend_lang=pl` then `=ja`: forecast for Lienz, `/hike` (app mode), a peak page, `/more`, `/privacy` — no horizontal scroll (`document.documentElement.scrollWidth <= 390`), no raw `{…}` or key names in `document.body.innerText`; screenshots read. Stop the server.

- [ ] **Step 5: Commit** — `git add mobile app/globals.css && git commit -m "Phone texts in the new languages; layout safety for long words and CJK"`

### Task 6: Ship

- [ ] **Step 1: CHANGELOG** — add under today's date:

```markdown
### Added — more languages
- **13 languages**: Dutch, Polish, Czech, Slovenian, Portuguese (Brazil),
  Japanese, Chinese (Simplified) and Korean join English, German, French,
  Spanish and Italian — website, app, notifications, widgets and the privacy
  notice. "System" picks the phone's language (Traditional Chinese phones get
  English); Polish, Czech and Slovenian counts use their own plural forms.
```

- [ ] **Step 2: Push + check** — `npm test`, commit, `git push origin main`; after the deploy: `curl -s -b metablend_lang=ja https://metablend.app/ | grep -c '日本語'` ≥ 1 and `curl -s -b metablend_lang=pl https://metablend.app/privacy | grep -c 'Polityka\|prywatności'` ≥ 1.

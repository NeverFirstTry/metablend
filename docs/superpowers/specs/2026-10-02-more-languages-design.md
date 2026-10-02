# More languages — design

Approved in chat 2026-10-02. Second of three queued sub-projects (more
mountains shipped; store prep follows).

## Goal

MetaBlend speaks 13 languages instead of 5. Every text a person reads in the
website, the app, its notifications and its widgets comes in the new
languages, and a test makes sure no language silently misses a text.

Owner's choices: the "Alps neighbours" and "big world languages" groups;
Brazilian Portuguese; approach "one file per language, all shipped".

## Languages

| Code | Picker label | Notes |
|---|---|---|
| `nl` | Nederlands | |
| `pl` | Polski | plural forms one / few / many |
| `cs` | Čeština | plural forms one / few / many |
| `sl` | Slovenščina | plural forms one / two / few / other |
| `pt` | Português (Brasil) | Brazilian spelling; `pt-PT` phones get it too |
| `ja` | 日本語 | no plural forms |
| `zh` | 中文（简体） | Simplified; `zh-TW`, `zh-HK`, `zh-MO` and `zh-Hant*` phones get English |
| `ko` | 한국어 | no plural forms |

The existing `en`, `de`, `fr`, `es`, `it` stay. "System" keeps following the
phone, English when the phone's language is not one of the 13.

## Structure

- `lib/i18n/<code>.js` — one module per language, each `export default { …texts }`.
  `en.js` is the reference.
- `lib/i18n.js` keeps its public interface (`LANGUAGES`, `t`, `tn`,
  `detectLang`, `preferredLang`, `langChoice`, `LANG_SYSTEM`,
  `getWeatherOptions` …) and builds its table from the 13 modules. No caller
  changes its imports.
- All 13 modules are bundled (≈ +50 KB gzip, cached after the first load);
  loading only the active language is a possible later optimisation, out of
  scope here.

## Plurals

`tn(lang, key, n)` picks the form with `Intl.PluralRules(lang).select(n)`:
the text under `key + One | Two | Few | Many` when the language has it, else
`key` (the "other" form). English/German/… keep working exactly as today
(`…One` for 1). Polish, Czech and Slovenian supply the extra forms for the
existing plural texts.

## What gets translated

- Every key of `en.js` (≈ 370 texts: weather, outlook, hiking, routes,
  notifications, widgets' server texts, settings, errors, weather condition
  names, region names).
- The privacy page (`app/privacy/content.jsx`) in full, each translated
  version with one added line: "This is a translation; if versions differ,
  the English version applies." (in that language).
- Phone texts: Android `res/values-<code>/strings.xml` (the strings
  `values-de` has), iOS `MetaBlendWidgets/Localizable.xcstrings` (widget
  gallery and edit texts) and `App/InfoPlist.xcstrings` (location prompt);
  the iOS project's known regions gain the 8 codes so the App Store lists
  them.
- The SEO `inLanguage` list in `app/layout.js` comes from `LANGUAGES`.
- Not translated: peak names, weather-service names, city names (those come
  from the geocoder in the chosen language, as today).

Translations are done by Claude with a fixed glossary (MetaBlend, SAC grade,
summit window, consensus, …). A native speaker's skim of ja / zh / ko is
welcome later; launch does not wait for it.

## Layout

- Japanese, Chinese and Korean use the phone's system fonts (no font
  download); the page `lang` attribute is set, so line breaking and hyphens
  follow the language.
- Long Polish / Czech / Dutch compounds: `hyphens: auto` (already on body
  text) plus `overflow-wrap: anywhere` on narrow UI labels so nothing
  overflows at 390 px.

## Tests

- Key parity: every language module has exactly the keys of `en.js` (no
  missing, no extra) and the same `{placeholders}` in each text.
- Plurals: `tn` gives the right form for pl / cs / sl (1, 2, 3, 5, 22, 25)
  and for en / ja.
- `detectLang`: `pt-BR` and `pt-PT` → `pt`, `zh-CN` / `zh-Hans` / `zh` → `zh`,
  `zh-TW` / `zh-HK` / `zh-Hant-TW` → `en`, `ja-JP` → `ja`, `sl-SI` → `sl`.
- Privacy content exists for all 13 codes.
- Visual check at 390 px in Polish and Japanese: forecast, hiking list, a
  peak page, More, privacy.

## Review focus

- A text missing in one language shows English mid-sentence — caught by the
  parity test.
- `{placeholder}` typos in a translation print raw braces — caught by the
  placeholder check.
- A Traditional-Chinese phone landing in Simplified Chinese — `detectLang`
  test.
- Long words overflowing buttons and chips on a phone — visual check.
- Notifications and widgets for a phone in a new language (server texts via
  `t(device.lang)`): `pickLang` accepts the new codes.

## Out of scope

Loading only the active language; right-to-left languages; store listings
(store prep sub-project).

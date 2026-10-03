# Accessibility pass — design

Approved in chat 2026-10-03.

## Goal

Make four App Store accessibility labels true for MetaBlend's common tasks
(check a city's forecast, open a peak and its routes, plan a hike, change
settings): **Larger Text**, **VoiceOver** (and TalkBack on Android),
**Sufficient Contrast**, **Differentiate Without Color Alone** — and keep
them true with an automated check in the repo. The website gets the same
fixes (same code).

Already true and unchanged: Dark Interface, Reduced Motion.

## 1. Larger Text

- **Native `TextScale` plugin** on both platforms, registered like
  `AppIconPlugin` / `WidgetBridgePlugin`:
  - iOS (`AppDelegate.swift`): `get()` → `{ scale }` with
    `scale = UIFont.preferredFont(forTextStyle: .body).pointSize / 17`;
    emits `change` on `UIContentSizeCategory.didChangeNotification`.
  - Android (`TextScalePlugin.java`): `get()` → `{ scale:
    configuration.fontScale }`; emits `change` from `onConfigurationChanged`
    / on resume when it differs.
- **Web side** `lib/text-scale.js`: `clampScale(s)` → between 1 and 2
  (rounded to 0.05); `applyTextScale(scale)` sets
  `document.documentElement.style.fontSize = 16 × scale px` only inside the
  app (`isNative()`), and clears it for 1. Wired in `AppChrome` at start and
  on `change`. Without the plugin (older app build) nothing happens.
- **Website:** no root font-size in px anywhere, so the browser's text-size
  setting keeps working (`html` has none today).
- **Fixed sizes:** the 20 `text-[10px]` / `text-[11px]` classes become
  rem-based (`text-[0.625rem]` / `text-[0.6875rem]`); fixed-width boxes that
  hold text (hour cards `w-14`/`w-16`, chips, the tab bar height) use rem or
  `min-w`, so at 200 % text they grow instead of clipping.
- **Check:** screenshots of the main screens with the root at 32 px (200 %)
  — no horizontal scroll, no clipped text.

## 2. VoiceOver / TalkBack

- **Spoken names:** every icon-only button and link gets `aria-label`
  (translated); decorative icons stay `aria-hidden`.
- **Summaries** (pure, translated, unit tested — `lib/a11y-text.js`):
  - temperature chart (`HourlyChart`): "From {min} at {minAt} to {max} at
    {maxAt}, rain chance up to {rain}%" → `role="img"` + `aria-label`;
  - each hour card (`HourStrip`, `SummitStrip`): one label "15:00, 23°,
    rain 0%" (summit adds wind, freezing level, storm risk), children
    `aria-hidden`;
  - agreement dots → "sources agree / mostly agree / disagree";
  - nowcast bars → the card's sentence is the label (`role="img"`);
  - elevation profile (`RouteProfile`) → "From {start} m up to {high} m";
  - the map (`RouteMap`, rain radar) → `aria-hidden` with the route's text
    summary nearby (already there).
- **Announcements:** loading states and "Updated just now" in
  `role="status"` / `aria-live="polite"`; errors `role="alert"`.
- **Order and focus:** visible focus ring everywhere (`:focus-visible`),
  the tab bar and dialogs (icon picker, push prompt) keyboard/VoiceOver
  reachable, `<details>` summaries named.
- **Voice Control:** accessible names start with the visible label.

## 3. Contrast and colour

- **Automated check** `scripts/a11y-check.mjs` (axe-core, dev dependency):
  runs on a local production build in headless Edge over `/`,
  `/?city=Vienna` (today + week), `/hike?app=1`,
  `/hike?peak=grossglockner&app=1`, `/more?app=1`, `/testers`, in the dark,
  light and sky themes; exits non-zero on any `serious` or `critical`
  violation and lists them. Added to `package.json` as `npm run a11y`.
- **Fix the tokens it flags** (expected: muted small text on the sky
  gradient, some zinc-500/600 on dark cards) in `app/globals.css` theme
  variables — one change per token, not per element.
- **Colour never alone:**
  - storm-risk bar (summit strip, legend): 1 / 2 / 3 segments for low /
    moderate / high, plus the word in the hour card's spoken label;
  - agreement dots: filled vs hollow dots (●●○) — already shape-coded;
    keep, and add the spoken label;
  - headline tone (green / amber / red): the sentence already says it;
  - rain-intensity bars: height + the sentence;
  - leaderboard deltas: "+" / "−" signs next to the colour;
  - heatmap points: the legend has words; each point's popup says
    "accurate / mixed / off".

## Texts

New keys in all 13 languages (parity test): chart summary, hour-card
label parts, agreement labels, icon-button names that have no text yet.

## Tests

- `npm run a11y`: 0 serious/critical on 7 pages × 3 themes (run in the
  plan's verify steps; it needs a local server).
- Unit tests for `lib/a11y-text.js` and `lib/text-scale.js`.
- Screenshots at 200 % text.
- `mobile/README.md` "Accessibility" checklist for the owner: VoiceOver
  and TalkBack walk through the four common tasks; largest text size on
  both phones; then tick the four labels in App Store Connect.

## Out of scope

Captions / audio descriptions (no media), a full WCAG audit of every
secondary page (aviation, planner) beyond what axe flags, right-to-left.

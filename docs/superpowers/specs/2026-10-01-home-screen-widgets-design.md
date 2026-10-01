# Home-screen widgets — design

Status: approved in conversation 2026-10-01; this spec is for review.
Follows the push notifications sub-project
(`2026-10-01-push-notifications-design.md`), which is live and verified on
iPhone and Android.

## 1. Intent

**The owner asked for:** every widget offered — small "right now", medium
"now + next hours", medium "now + next days" and a hike widget — "and just
make them configurable"; a city choice of **home city** or **one of the
recent cities** (no search, no current location); the **living sky** look
with a switch to a plain system style; widgets that **fetch their own data**
(approach 1 of 3).

**Why (assumed, not contradicted):** the forecast at a glance without opening
the app — a daily reason to keep MetaBlend on the home screen, and native
value the website can't offer.

**Success looks like:**
- a widget added once keeps showing the current blend for its city for days
  without the app being opened, refreshed about every 30 minutes;
- the widget's temperature matches the app's big number for the same city
  (same blend, same caches);
- two widgets can show two cities (e.g. Lienz and Vienna);
- the hike widget shows the next planned hike's summit window or day summary;
- tapping opens the app on that city or that hike;
- offline it shows the last data with its time instead of going blank;
- 1 or 10,000 widgets for a city cost the same forecast requests (CDN).

**Out of scope:** searching any city in the widget settings, current-location
widgets, large / extra-large sizes, lock-screen and watch widgets, iOS Live
Activities, server-pushed widget updates, widgets on iOS older than 17.

## 2. Facts this rests on

Verified 2026-10-01 against the live API and the repo:
- `/api/forecast?city=&lang=` returns `consensus.temp` (the app's big number),
  `city`, `learnCity`, `warning`, `rainingNow`; CDN-cached 15 min per city and
  language, with a per-IP throttle on cache misses.
- `/api/outlook?city=&lang=` returns `nowLocal`, `sun {sunrise, sunset}`,
  `hourly[] {t, temp, rainPct, icon, code}` (from the current hour) and
  `days[] {date, tempMax, tempMin, icon, condition, rainPct}`.
- Weather icons are emoji (`☀️ 🌤 ⛅ ☁️ 🌧 …`); `lib/sky.js` has `skyFor()`
  (code + city time + sun → `night|dawn|day|cloudy|rain|storm|snow|dusk`),
  `SKIES` (three colours per sky) and `nightIcon()`.
- `/api/hike?lat=&lon=&elev=&name=` returns `days[] {date, tempMax, tempMin,
  windMax, rainPct, storm, icon}` at summit height and `windows.today` /
  `windows.tomorrow` = `{ window: {from, to, hours} | null, next }`. There is
  no good/fair/poor verdict — the window (or its absence) is the verdict.
- Hike plans are stored per push device (`/api/push/plans`, fields `name,
  lat, lon, elev, date`, date within the next 7 days).
- City views are counted in native Preferences `mb_city_views`
  (`{"Lienz":7}`); the home city is `push_devices.home_name`, else the
  most-viewed city (`lib/push-client.js`, `NotificationSettings.jsx`).
- No `appUrlOpen` handling exists yet; notification taps route through
  `initPush({ onOpen })` in `AppChrome.jsx`.
- iOS app deployment target is 15.0; Capacitor 8.5; push uses the App target's
  `AppDelegate.swift`. Android: AGP 9.4.1, Java only (`android.builtInKotlin=
  false`), compile/target SDK 36, min SDK 24.
- Platform facts relied on: WidgetKit `AppIntentConfiguration` (configurable
  widgets) needs iOS 17; iOS budgets roughly 40–70 widget refreshes a day;
  Android `updatePeriodMillis` has a 30-minute minimum; Android 12+ supports
  size-mapped `RemoteViews` and `widgetFeatures="reconfigurable"`.

## 3. What people get

### Weather widget
- **iOS:** small and medium families. **Android:** one resizable widget —
  the small layout up to ~3 cells wide, the medium layout from 4 cells.
- **Small:** city, current temperature (the blend's `consensus.temp`), icon,
  condition word, today's high / low, data time when stale.
- **Medium:** the small content on the left; on the right either the next
  6 hours (time, icon, temperature, rain %) or the next 5 days (weekday,
  icon, high / low).
- **Settings** (iOS: long-press → Edit Widget; Android: a screen when the
  widget is added, again via long-press → reconfigure on Android 12+):
  - **City:** "Home city" (default) or one of the recent cities.
  - **Show:** Next hours (default) / Next days — affects medium only.
  - **Style:** Living sky (default) / System.

### Hike widget
- **Small:** next planned hike — peak name, day ("Tomorrow", "Sat"), and
  either the summit window ("08:00–18:47") or "No good window"; for a hike
  more than a day out, the summit high / low and max wind instead.
- **Medium:** adds summit temperature range, wind, rain % and storm risk for
  that day.
- "Next" = the earliest plan dated today or later by the phone's local date
  (plans are days, not times).
- No upcoming plan: "Plan a hike in the app".
- **Settings:** Style only.

### Both
- °C / °F and the language follow the app (synced, §4.2).
- Living sky: background is the `SKIES` gradient of the sky at that city
  *now* (per hour on iOS, §4.3); white text. System: the platform's widget
  background, text in the system colours, only the emoji in colour.
- iOS tinted / clear home screens (accented rendering): the sky background is
  dropped automatically and text follows the system tint.
- Tap → app opens on `/?city=<city>` (weather) or the peak's hike view
  (hike), via the `metablend://` link (§4.5).

## 4. Architecture

```
 app (website in WebView) ──sync()──▶ WidgetBridge (native, in the app)
                                         │ writes shared settings
                                         ▼
            iOS App Group / Android SharedPreferences "widget"
                                         │ read by
                                         ▼
      iOS widget extension / Android widget providers ──GET──▶ /api/widget
                                                                  │ CDN 15 min
                                                    forecast + outlook / hike
```

### 4.1 Server: `GET /api/widget`

Public, no device key. Two kinds:

- **Weather** `?city=<name>&lang=de&unit=C` →
  ```json
  { "kind": "weather", "city": "Lienz", "updated": "2026-10-01T21:05",
    "now": { "temp": 13, "icon": "⛅", "text": "Bewölkt", "sky": "night" },
    "today": { "hi": 21, "lo": 11 },
    "hours": [ { "t": "22:00", "icon": "☁️", "temp": 13, "rain": 0, "sky": "night" } ],
    "days":  [ { "date": "2026-10-02", "day": "Fr", "icon": "⛅", "hi": 19, "lo": 9 } ],
    "skies": { "night": ["#060a1c", "#101d45", "#27366b"] } }
  ```
  `hours` = next 6 (city time, `HH:MM`, night icons via `nightIcon`);
  `days` = next 5 starting tomorrow; `skies` = only the palettes this payload
  uses. Temperatures rounded in the requested unit.
- **Hike** `?kind=hike&name=&lat=&lon=&elev=&date=&lang=&unit=` →
  ```json
  { "kind": "hike", "peak": "Hochstadel", "date": "2026-10-02", "day": "Morgen",
    "window": { "from": "08:00", "to": "18:47" }, "noWindow": false,
    "summit": { "hi": 12, "lo": 4, "wind": 7, "rain": 0, "storm": "low" },
    "sky": "day", "skies": { "day": ["#1a5aa6", "#3b83cf", "#8cc0ea"] } }
  ```
  For today or tomorrow at the peak: `window` from the hike engine, or
  `null` with `noWindow: true` when there is none. Later dates: `window:
  null, noWindow: false` (no verdict yet — the day summary is shown). A date in the past or
  beyond the hike forecast → 400.

**Data source:** the route calls the same library functions the forecast,
outlook and hike routes use (moved out of the route files where they are
inline today), so the numbers equal the app's. It does **not** fetch its own
API over HTTP — the forecast route's per-IP throttle would treat every
widget miss as one client.

**Caching:** response `Cache-Control: public, s-maxage=900,
stale-while-revalidate=1800` keyed by the full query; errors `no-store`.
Cache misses go through the same per-IP limiter as `/api/forecast`.

**Pure, tested core:** `lib/widget.js` — `weatherPayload({forecast, outlook,
lang, unit})`, `hikePayload({hike, plan, lang, unit, today})`,
`parseWidgetQuery(searchParams)`. The route only wires them up.

### 4.2 App → widget bridge

A local Capacitor plugin `WidgetBridge` compiled into the app (no npm
package):
- iOS: `WidgetBridgePlugin.swift` in the App target, registered from a
  `CAPBridgeViewController` subclass (`capacitorDidLoad` →
  `registerPluginInstance`), the storyboard pointing at that subclass.
- Android: `WidgetBridgePlugin.java`, registered in `MainActivity.onCreate`
  before `super.onCreate`.
- One method, `sync(payload)`: stores the JSON string under `widget_settings`
  in the App Group `group.app.metablend` (iOS, `UserDefaults(suiteName:)`) or
  SharedPreferences `widget` (Android), then reloads widgets
  (`WidgetCenter.shared.reloadAllTimelines()` /
  `AppWidgetManager` update broadcast).

Payload (built by pure `lib/widget-sync.js` → `widgetSettings({...})`):
```json
{ "v": 1, "lang": "de", "unit": "C", "base": "https://metablend.app",
  "home": "Lienz", "recent": ["Lienz", "Wien", "Innsbruck"],
  "hikes": [ { "name": "Hochstadel", "lat": 46.79, "lon": 12.86, "elev": 2681, "date": "2026-10-02" } ] }
```
- `home` = notification home city, else the most-viewed city, else null.
- `recent` = up to 8 cities by view count (ties: alphabetical), home first.
- `hikes` = upcoming plans (date ≥ today), soonest first, max 5. Plans exist
  only for phones with notifications on; otherwise `[]`.
- Called on app start, after a city view changes the recent list, after the
  home city / language / unit changes, after a hike plan is added or removed.
  Skipped when the payload equals the last one sent (kept in memory).
- On the website (not native) every call is a no-op.

### 4.3 iOS widget extension `MetaBlendWidgets` (iOS 17+)

SwiftUI + WidgetKit, its own target with deployment target 17.0 (the app stays
at 15.0; on 15–16 the widgets just don't appear).
- **App Group** `group.app.metablend` on the App and the extension.
- `WeatherWidget` (`.systemSmall`, `.systemMedium`) with
  `AppIntentConfiguration<WeatherConfig>`: `city: CityEntity?` (options from
  `home` + `recent`; nil = home), `show: ShowEnum` (hours/days), `style:
  StyleEnum` (sky/system).
- `HikeWidget` (`.systemSmall`, `.systemMedium`) with `HikeConfig {style}`.
- **Timeline:** fetch `/api/widget` (10 s timeout); build one entry now plus
  one per upcoming hour from `hours` (temperature, icon and sky of that hour;
  the left side's "today" stays); policy `.after(now + 30 min)`. Last good
  payload per configuration cached in the App Group; on failure use it with
  the stale marker; none → the "Open MetaBlend once" placeholder.
- `containerBackground` = sky gradient (style sky) or default (system);
  `widgetRenderingMode == .accented` → no gradient.
- `widgetURL(metablend://open?path=…)`.

### 4.4 Android widgets

Java, `RemoteViews` layouts (no Kotlin / Compose — the build stays as is).
- `WeatherWidgetProvider`, `HikeWidgetProvider` + `appwidget-provider` XMLs:
  resizable, `updatePeriodMillis=1800000`, `widgetFeatures="reconfigurable"`,
  a configure activity for the weather widget (and the hike widget's Style).
- **Layouts:** small and medium per widget; Android 12+ gets a size map
  (`RemoteViews(Map<SizeF, RemoteViews>)`), older versions pick by
  `OPTION_APPWIDGET_MIN_WIDTH`.
- **Configure screen** `WidgetConfigActivity`: a plain native list — City
  (Home + recent), Show (hours/days), Style (sky/system) — saved per
  `appWidgetId` in SharedPreferences `widget`; texts in the synced language
  (en, de, fr, es, it — a small string table in the activity).
- **Refresh:** `onUpdate` → `goAsync()` + one background thread: fetch (8 s
  timeout), render, cache last good payload per widget id. Also refreshed
  after a bridge `sync`.
- **Sky:** a bitmap gradient drawn from the payload's `skies` colours into an
  `ImageView` behind the content (RemoteViews can't take a dynamic gradient
  drawable). System style: `@android:color/system_neutral1_*` (Android 12+)
  or a plain light/dark background.
- Tap → `PendingIntent` with `metablend://open?path=…` to `MainActivity`.
- Data time shown and content dimmed when the cached payload is older than
  3 h.

### 4.5 `metablend://` deep link

- iOS: `CFBundleURLTypes` scheme `metablend` in `Info.plist`; Android: an
  `intent-filter` (`VIEW`, `BROWSABLE`, scheme `metablend`) on
  `MainActivity`.
- Website: `lib/deep-link.js` → `pathFromAppUrl(url)` accepts only
  `metablend://open?path=/…` with a same-site path (starts with `/`, not
  `//`), else null. `AppChrome` listens to `App.addListener('appUrlOpen')`
  (and `App.getLaunchUrl()` at start) and routes with the same `onOpen` the
  push taps use.

## 5. Errors and edge cases

| Case | Behaviour |
|---|---|
| Offline / server error / timeout | Last good payload + "14:05"; dimmed after 3 h |
| Nothing cached and no settings yet | "Open MetaBlend once to pick a city" |
| Settings exist, no home city | Weather widget: "Pick a city in MetaBlend" |
| Configured city no longer in `recent` | Keeps working (the name is stored per widget) |
| City unknown to the server (404) | Falls back to home city once; else placeholder |
| Hike date passed | Skip to the next plan; none → "Plan a hike in the app" |
| Bad query | 400 `{error}`, `no-store` |
| Language/unit changed in the app | `sync` → widgets reload in the new language/unit |
| Deep link with foreign or odd path | Ignored (app opens on its current screen) |

## 6. Testing

- `node --test`: `lib/widget.js` (payload shaping, rounding, unit switch,
  night icons, sky per hour, hike window vs. day summary, query parsing),
  `lib/widget-sync.js` (home / recent / hikes selection, ordering, limits,
  no-op equality), `lib/deep-link.js` (accepted and rejected URLs).
- Route smoke: `/api/widget?city=Lienz` and `?kind=hike…` on the deployment.
- Android: `gradlew assembleDebug` here; on the emulator when adb reaches it.
- iOS: owner builds on the Mac.
- Device checklist added to `mobile/README.md` (add each widget, both
  sizes, change city/show/style, two cities side by side, offline, tap opens
  the right screen, German + °F, iOS tinted home screen, Android resize).

## 7. Build order

One plan, three stages, each shippable:
1. **Web side** — `/api/widget`, `lib/widget.js`, `lib/widget-sync.js` + the
   sync calls, `lib/deep-link.js` + `appUrlOpen` routing. Live immediately;
   inert until the native parts exist.
2. **Android** — bridge plugin, deep-link intent filter, providers, layouts,
   configure activity. Built and checked on Windows.
3. **iOS** — owner step in Xcode first: File → New → Target → Widget
   Extension "MetaBlendWidgets" (no Live Activity, no configuration intent
   template), then + Capability → App Groups → `group.app.metablend` on both
   the App and the extension targets. Then the Swift files (bridge, URL
   scheme, widgets) are added to those targets.

Native parts reach users with the next app build / store release.

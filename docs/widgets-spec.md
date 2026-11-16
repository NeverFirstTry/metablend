# Home-screen widgets: look and layout

Spec for the native build (iOS WidgetKit and Android RemoteViews). The owner approved the mockups on 2026-11-16: "Slate in dark and white in light as default, the faint gold sheen in dark stays, Mono, Winter and Sky as drawn. Only those three app themes change the widgets, the other 8 icons keep the default. The per-widget theme choice stays after launch."

- **Mockups:** `store/design/widgets/widgets.html`. Open it in a browser; it has a German and English switch and a theme switch. Regenerate with `node scripts/brand/widget-mockups.mjs`. The data is a snapshot of production's `/api/app-widget` for Lienz and the Hochstein hike on 16 November (`store/design/widgets/data/`).
- **Assets:** `store/design/widgets/assets/`: the icons as 24 × 24 SVG templates and the theme scenery (lucide icons, ISC licence in `LICENSE-lucide.txt`).
- **Units:** all sizes are iOS points, the same number in dp on Android. Text sizes are pt on iOS and sp on Android.

## What this build changes

1. **Default look follows the phone's appearance:** Slate in dark mode, white in light mode. The old blue "living sky" goes.
2. **Three themes on top:** Mono, Winter and Sky. A widget takes one of them when that icon is the app icon chosen under More. The other 8 icons keep the default.
3. **The hike widget's layout is fixed:** everything is aligned to the top (Trello card "Neuer nativer Build", comment of 15 November).
4. **Icons:** the emoji become the website's drawn icons in the theme's colours.
5. **No style setting before launch:** the current "Style" option (Living sky / System) is removed on both platforms. A per-widget "Theme" choice comes after launch (section 11). It is not part of this build.
6. **All 13 languages:** every widget text the app shows, including the settings screen on Android and the messages, ships in the app's 13 languages (section 10). Two tables cover only 5 today.

**Order:** first the server and web part (section 9) goes out with a website deploy. Then the native build ships. Older app builds ignore the new fields.

## 1. Which look a widget gets

| App icon chosen under More | Widget theme |
|---|---|
| `mono` | Mono |
| `winter` | Winter |
| `sky` | Sky |
| `slate` (default), `glow`, `gold`, `light`, `butter`, `summit`, `weather`, `dots`, none or unknown | Default |

Each theme has a dark and a light version. The widget uses the phone's appearance:
- iOS: `@Environment(\.colorScheme)`.
- Android: `Configuration.UI_MODE_NIGHT_MASK`, or night resource qualifiers (section 8).

The theme reaches the widgets in the settings the app syncs (`theme` in `widget_settings`, section 9).

## 2. Colours

| Role | Default dark | Default light | Mono dark | Mono light | Winter dark | Winter light | Sky dark | Sky light |
|---|---|---|---|---|---|---|---|---|
| Background | `#0f151b` + sheen | `#ffffff` | `#000000` | `#ffffff` | `#0f151b` | gradient `#e3ecf7` → `#f4f8fc` | gradient `#1b2452` → `#352f62` (55 %) → `#4f4072` + peach edge | gradient `#eaf3fd` → `#c6dcf5` |
| Ink (names, numbers) | `#f6f8fc` | `#141c2b` | `#ffffff` | `#000000` | `#f6f8fc` | `#141c2b` | `#ffffff` | `#0f1b33` |
| Muted (labels, secondary) | `#b4bbc7` | `#4a5566` | `#a6a6a6` | `#595959` | `#b4bbc7` | `#44546a` | `#e2e2f0` | `#34445e` |
| Window (favourable) | `#8eecc4` | `#117948` | `#ffffff` | `#000000` | `#8eecc4` | `#117948` | `#a7f3d0` | `#0f6b40` |
| Rain (drop, rain %) | `#a9d1ff` | `#1c68c0` | `#d4d4d4` | `#404040` | `#a9d1ff` | `#1c68c0` | `#dbe9ff` | `#1a5fb0` |
| Sun (gold accent) | `#ffd98a` | `#966400` | `#ffffff` | `#000000` | `#ffd98a` | `#966400` | `#ffd98a` | `#8a5c00` |
| Moon | `#a99fd4` | `#6b5d9d` | `#d4d4d4` | `#404040` | `#a99fd4` | `#6b5d9d` | `#ddd5ff` | `#5e5191` |
| Cloud, fog | `#a3aab5` | `#4a5566` | `#a6a6a6` | `#595959` | `#a3aab5` | `#4a5566` | `#d3d6e6` | `#3f4c63` |

All gradients run top to bottom.

**Contrast:** each value is the lowest on its background (for a gradient, at its weakest point; Sky dark includes the peach corner at full strength).

| | Ink | Muted | Window | Rain | Sun |
|---|---|---|---|---|---|
| Default dark | 17.3 | 9.5 | 13.1 | 11.6 | 13.6 |
| Default light | 17.1 | 7.5 | 5.5 | 5.5 | 5.1 |
| Mono dark | 21.0 | 8.6 | 21.0 | 14.2 | 21.0 |
| Mono light | 21.0 | 7.0 | 21.0 | 10.4 | 21.0 |
| Winter dark | 17.3 | 9.5 | 13.1 | 11.6 | 13.6 |
| Winter light | 14.3 | 6.5 | 4.6 | 4.6 | 4.3 |
| Sky dark | 5.9 | 4.6 | 4.6 | 4.8 | 4.3 |
| Sky light | 12.2 | 7.0 | 4.7 | 4.5 | 4.1 |

All text reaches 4.5:1. The sun is an icon and needs 3:1.

**Colour rules:**
- Gold appears only on the sun.
- Green appears only on a favourable window. In Mono the window is in ink, and its label carries the meaning.
- No colour is the only carrier of meaning: the window always has its label (section 6).

## 3. Background and scenery

The scenery always sits behind the content (iOS: under the content in a `ZStack`, or in `containerBackground`; Android: views before the content in a `FrameLayout`). It shows only in full colour (section 7).

### Default dark: the sun's sheen

This is the website's sheen at half its strength. It follows the payload's `sky`: weather `now.sky`, or the current hour's `sky` once the timeline moves on; hike `sky`.

| `sky` | Centre | Radii (of width, of height) | Colour at the centre | Fades out at |
|---|---|---|---|---|
| `dawn` | top left corner (0 %, 0 %) | 90 %, 70 % | `#ffd98a` at 9 % | 70 % of the radius |
| `day` | top centre (50 %, 0 %) | 110 %, 55 % | `#ffd98a` at 8 % | 80 % of the radius |
| `dusk` | top right corner (100 %, 0 %) | 90 %, 70 % | `#ffc470` at 10 % | 70 % of the radius |
| `night` and anything else | none | | | |

This is an elliptical radial gradient: the colour at the centre fades linearly to transparent at the given share of the ellipse's radius.
- **iOS:** draw a circle filled with a `RadialGradient` and scale it to the ellipse with `scaleEffect(x:y:)`.
- **Android:** a `VectorDrawable` with a radial `<gradient>` in a 100 × 100 viewport. Put it in an `ImageView` with `scaleType="fitXY"`; the stretch makes the circle the ellipse.

Default light has no sheen, and the themes have none.

### Winter

- **Specks:** `winter-specks.svg` (opaque white), 110 × 77, inset 6 from the top and the right edge.
  - Dark: colour `#f6f8fc` at 30 % opacity. Light: `#ffffff` at 100 %.
- **Snow band:** `winter-snow.svg` (opaque white, stretches horizontally), full width, 16 high, at the bottom edge, inside the bottom margin, so no text overlaps it.
  - Dark: `#e9eef5` at 22 % opacity. Light: `#ffffff` at 100 %.

### Sky

- **Gradient:** as in the colour table.
- **Peach edge (dark only):** an elliptical radial gradient centred at (100 %, 115 %), radii 90 % of the width and 60 % of the height, `#e8957a` at 30 %, transparent at 70 % of the radius.
- **Clouds:** two copies of `sky-cloud.svg` (opaque white, 74 × 60 artwork), clipped by the widget's corner.

| Cloud | Size | Right edge | Top edge | Opacity dark | Opacity light |
|---|---|---|---|---|---|
| Large | 55.5 × 45 | 4.75 in from the right edge | 8.75 above the top edge | 9 % | 60 % |
| Small | 37 × 30 | 3.5 beyond the right edge | 4.5 above the top edge | 14 % | 85 % |

Set the opacity on the view, never inside the artwork: the cloud is overlapping circles and must read as one shape.

### Corners and margins

- **iOS:** the system's corner radius (`containerBackground(for: .widget)`); clip scenery with `ContainerRelativeShape`. Standard margins: 16 on every side.
- **Android:** the root has `android:clipToOutline="true"`, with the background radius `@android:dimen/system_app_widget_background_radius` on Android 12 and later, 24 dp before that (the current `widget_bg.xml` has 20 dp). Padding 16 dp.

## 4. Type

iOS uses SF Pro (the system font). Android uses Roboto: `sans-serif`, `sans-serif-medium` for "semibold" and "medium", `sans-serif-light` for the big temperature. All numbers use tabular digits (iOS `.monospacedDigit()`; Android `android:fontFeatureSettings="tnum"`). Nothing is smaller than 13.

| Use | Size / line height | Weight | Colour | iOS text style |
|---|---|---|---|---|
| Place or peak name | 15 / 20 | semibold | ink | `.subheadline.weight(.semibold)` |
| Secondary: day, condition, labels, high and low, rain and wind line, update time | 13 / 18 | regular | muted | `.footnote` |
| Big temperature (city) | 44 / 50 | light, tracking −0.02 em | ink | `.system(size: 44, weight: .light)` |
| Summit window, medium | 24 / 30 | semibold | window (favourable) or ink | `.system(size: 24, weight: .semibold)` |
| Summit window, small | 22 / 28 | semibold | as above | `.title2.weight(.semibold)` |
| Hour cell: time | 13 / 18 | regular | muted | `.footnote` |
| Hour cell: temperature | 15 / 20 | medium | ink | `.subheadline.weight(.medium)` |
| Hour cell: rain % | 13 / 18 | regular | rain | `.footnote` |
| Hike facts (wind, rain, storm risk) | 13 / 18 | regular | ink | `.footnote` |

**Fitting the text:**
- iOS: cap the widget at `.dynamicTypeSize(...DynamicTypeSize.xxLarge)`. Use `lineLimit(1)` and `minimumScaleFactor(0.8)` on the name, the window and the big temperature.
- Android: `maxLines="1"` and `ellipsize="end"` on the name. The window and the big temperature don't wrap.

The high and low read `↑ 11°  ↓ 1°` (two spaces before the down arrow), as now.

## 5. Icons

The payload keeps sending emoji in `icon`. The widget maps them to the assets the same way `app/components/Glyph.jsx` does on the website:

| Emoji (variation selector removed) | Asset | Colour role |
|---|---|---|
| ☀ | `icon-sun` | sun |
| 🌙 | `icon-moon` | moon |
| ☁ | `icon-cloud` | cloud |
| ⛅ 🌤 🌥 | `icon-cloud-sun-rays` and `icon-cloud-sun-cloud` stacked | rays: sun; cloud: cloud |
| 🌦 | `icon-cloud-drizzle` | rain |
| 🌧 | `icon-cloud-rain` | rain |
| 🌨 ❄ | `icon-cloud-snow` | rain |
| ⛈ 🌩 | `icon-cloud-lightning` | rain |
| 🌫 | `icon-cloud-fog` | cloud |
| anything else | no icon | |

The facts use these icons:

| Fact | Asset | Colour role |
|---|---|---|
| Peak | `icon-mountain` | ink |
| Wind | `icon-wind` | muted |
| Rain | `icon-droplet` | rain |
| Storm risk | `icon-zap` | muted |

The assets are stroked outlines: 24 × 24 viewBox, stroke 2, round caps and joins, colour applied at run time.
- **iOS:** add them to the widget extension's asset catalog with "Preserve Vector Data" and "Render As: Template Image"; draw with `Image("icon-sun").resizable().foregroundStyle(color)`.
- **Android:** import with Android Studio's Vector Asset tool; tint with `setInt(id, "setColorFilter", color)`, or a tint colour resource (section 8).

## 6. Layouts

All four widgets have 16 padding on every side. "Content" is the area inside the padding (iOS medium on a 430 pt wide iPhone: 364 × 170 widget, 332 × 138 content).

### Hike, small (iOS small 170 × 170, Android 2 × 2)

One column, everything from the top, nothing pinned to the bottom:

```
[mountain 15] 6 [Hochstein            ]   name, 15 semibold, 1 line
Tomorrow                                   day, 13 muted
                                           gap 10
Summit window                              label, 13 muted
08:00-13:33                                window, 22 semibold, window colour
                                           gap 6
[glyph 20] 6 ↑ 2°  ↓ -3°                   13 ink
(space left over)
```

### Hike, medium (iOS medium 364 × 170, Android 4 × 2)

Two columns, both aligned to the top, 16 apart.
- **Left column:** flexible width. Same as small, but the window is 24.
- **Right column:** fixed width, 144 on iOS and 140 on Android. Its first row is level with the peak name.

```
[mountain] Hochstein          [wind 15] 6 25 km/h
Tomorrow                      gap 10
                              [drop 15] 6 72%
Summit window                 gap 10
08:00-13:33                   [zap 15] 6 Storm risk: low   (up to 2 lines: "Gewitterrisiko: gering" wraps)
[glyph] ↑ 2°  ↓ -3°
```

The icons in the right column sit 2 lower than their text's first line, so they centre on it.

**States of the window block:**

| Payload | Shows |
|---|---|
| `line` set and `label` set (a window) | the label, then `line` in the window style. Window colour when `good` is true, else ink (storm data missing). |
| `line` set and `label` null ("No favourable window", "No daylight left today") | `line` alone, 15 semibold, ink, up to 2 lines. No label. |
| `line` null (the day is beyond tomorrow) | no window block: the glyph and temperatures follow the day directly, after the gap of 10 |

### City, small (iOS small, Android 2 × 2)

```
Lienz                                      name, 15 semibold
7°  8 [glyph 30]                           44 light; the glyph centred on the number
(flexible space)
Partly cloudy                              13 muted, 1 line
↑ 11°  ↓ 1°                                13 muted
```

### City, medium (iOS medium, Android 4 × 2)

- **Left column:** width 116. Content as small, but the glyph is 28, plus one more row at the bottom: `[drop 13] 4 9%  [wind 13] 4 3 km/h` (13 muted).
- **Right column:** 12 to the right of the left column. Five equal cells across the remaining width, each filling the full content height with its four items spread evenly, top to bottom:
  1. Time (13 muted).
  2. Glyph 20.
  3. Temperature (15 medium).
  4. Rain % (13 rain).
- The time row lines up with the name; the rain row lines up with the last row on the left.
- **"Next days" option:** weekday, glyph, high (15 medium) and low (13 muted).

### City, large (iOS large, Android 4 × 4)

Not drawn. It keeps today's structure: the header, the next 6 hours, then the next 5 days. Apply this spec's colours, type, icons and padding to it.

### Other states, all widgets

- **Old data:** the payload came from the cache. Show the time it was fetched (`Text(fetched, style: .time)`, 13 muted).
  - Small widgets: one more row at the end of the column.
  - City medium: in place of the rain and wind row.
  - Hike medium: at the end of the left column.
  - More than 3 hours old: the content at 55 % opacity, as now.
- **Message** (no settings yet, no city, no hike planned, offline): the text centred, 13 muted, on the theme's background with its scenery. The texts are in section 10, in all 13 languages. The offline message loses its dash: "No connection. Tap to open MetaBlend."

## 7. iOS notes

- **Remove before launch:** `WidgetStyle`, the `style` parameters in `WeatherConfig` and `HikeConfig`, `SkyBackground`, `palette(sky:mode:)`, and the catalog entries "Style", "Living sky" and "System" in `Localizable.xcstrings`.
- **Texts:** `Texts` in `MetaBlendWidgets.swift` gets all 13 languages from section 10.
- **Read the theme:** `WidgetSettings` gets `let theme: String?`. Absent or unknown means Default. Add a `WidgetTheme` resolver from that `theme` and the colour scheme (sections 1 and 2).
- **Accented rendering mode** (tinted and clear home screens):
  - The system removes the background. Draw no sheen, specks, snow band, peak or clouds there.
  - Mark the big temperature and the summit window `.widgetAccentable()`.
  - Icons render as template images in `.primary`; the two-colour partly-cloudy icon becomes one colour.
- **StandBy:** keep the background removable (the default); the content alone must read.
- **Gallery preview:** `placeholder` and `snapshot` show the real layout with sample values, not "MetaBlend" alone.

## 8. Android notes

- **Texts:** `WidgetText.java` gets all 13 languages from section 10, without the keys `style`, `sky` and `system`.
- **Remove before launch:**
  - the "Style" radio group in `WidgetConfigActivity` and the `style` key in `WidgetStore`;
  - the `sky` `ImageView` and `gradient()` in `WidgetRenderer`;
  - the `look.sky` paths and `WHITE`, `WHITE_DIM`, `GOOD_ON_SKY`.
  - `widget_bg` in `values/` and `values-night/` gives way to the theme resources below.
- **Colours per theme and appearance:** colour resources named `w_<theme>_<role>` (for example `w_default_ink`), with the light value in `values/colors.xml` and the dark value in `values-night/colors.xml`.
  - On Android 12 and later, apply them with `RemoteViews.setColorStateList(id, "setTextColor", R.color.w_default_ink)` (and `"setColorFilter"` for icons). They then switch with the phone's appearance without a new render.
  - Before Android 12, resolve them for the current `uiMode` and use `setTextColor`; the widget catches up at its next update.
- **Backgrounds:**
  - one drawable per theme, with a `drawable-night` variant: the solid or gradient shape;
  - the sheen `VectorDrawable` per `sky` (Default dark only);
  - the peach edge (Sky dark).
  - Stack them in `ImageView`s at the back of a `FrameLayout` root, with the scenery `ImageView`s (specks, snow band, clouds) at their sizes and opacity (`setInt(id, "setImageAlpha", 0-255)`).
- **Icons:** `ImageView`s in place of today's emoji `TextView`s (`R.id.icon`, `R.id.cell_icon`, the peak, wind, rain and storm prefixes). Partly cloudy is two `ImageView`s stacked in a `FrameLayout`.
- **Sizes:** keep today's thresholds (`sized()`: small below 250 dp wide, large from 230 dp high for the weather widget).
- **Hike medium:** the right column's `LinearLayout` loses `android:gravity="center_vertical"` and aligns to the top.

## 9. Data: server and app

These are web changes in this repository. They go out with a website deploy before the native build ships, and stay compatible with older app builds.

1. **`lib/app-widget.js`, `weatherPayload`:** add `now.rain` (`pct(current?.rainPct)`) and `now.wind` (`kmh(forecast.consensus?.windKmh)`), so the native code no longer splits `detail`. Keep `detail` and `skies` for older builds.
2. **`lib/app-widget.js`, `hikePayload`:** add `label: slot?.window ? t(lang, 'mtnWindow') : null`. The label is "Summit window" / "Gipfelfenster", already in all 13 language packs.
3. **`lib/app-widget-sync.js`, `widgetSettings`:** add `theme`, one of `'default' | 'mono' | 'winter' | 'sky'` (`['mono', 'winter', 'sky'].includes(icon) ? icon : 'default'`), with a unit test. `v` stays 1.
4. **`lib/app-widget-client.js`, `syncWidgets`:** read the icon with `currentIcon()` (`lib/app-icon.js`) and pass `icon?.name`.
5. **`app/components/AppIconPicker.jsx`:** after a successful `setIcon`, call `syncWidgets()`. The bridges already reload every widget on sync: iOS `WidgetCenter.shared.reloadAllTimelines()`, Android `WidgetBridgePlugin.sync`.

## 10. Widget texts in all 13 languages

The app speaks 13 languages; two tables in the widget code cover only 5 today (en, de, fr, es, it). This build ships all 13:
- **iOS:** `Texts` in `MetaBlendWidgets.swift` holds "Home city" and the four messages.
- **Android:** `WidgetText.java` holds the settings screen and the same four messages.

Both pick the row by the `lang` the app syncs, which uses the app's codes `en de fr es it nl pl cs sl pt ja zh ko`; Edit Widget on iPhone uses the phone's language. The wording reuses the app's own words where the app has them:
- "Home city": `notifHome`;
- the theme names: `appIconMono`, `appIconWinter`, `appIconSky`;
- City, Show, Next hours and Next days: the iOS widget catalog.

Each language keeps its pack's form of address: formal in Czech and Portuguese, polite in Japanese and Korean, informal in German, Dutch, Polish and Slovenian. None of the texts has a dash.

**Already in all 13 languages, no change:**
- the widget names and descriptions in the gallery (iOS `Localizable.xcstrings`, Android `widget_*_name` and `widget_*_desc` in `res/values*/strings.xml`);
- the iOS Edit Widget labels City, Show, Next hours and Next days.

### Settings screen and "Home city"

| | Widget settings | City | Home city | Show | Next hours | Next days | Save |
|---|---|---|---|---|---|---|---|
| en | Widget settings | City | Home city | Show | Next hours | Next days | Save |
| de | Widget-Einstellungen | Ort | Heimatstadt | Anzeigen | Nächste Stunden | Nächste Tage | Speichern |
| fr | Réglages du widget | Ville | Ville principale | Afficher | Prochaines heures | Prochains jours | Enregistrer |
| es | Ajustes del widget | Ciudad | Ciudad principal | Mostrar | Próximas horas | Próximos días | Guardar |
| it | Impostazioni widget | Città | Città principale | Mostra | Prossime ore | Prossimi giorni | Salva |
| nl | Widgetinstellingen | Stad | Thuisstad | Weergeven | Komende uren | Komende dagen | Opslaan |
| pl | Ustawienia widżetu | Miasto | Miasto domowe | Pokaż | Najbliższe godziny | Najbliższe dni | Zapisz |
| cs | Nastavení widgetu | Město | Domovské město | Zobrazit | Příští hodiny | Příští dny | Uložit |
| sl | Nastavitve pripomočka | Kraj | Domači kraj | Prikaži | Naslednje ure | Naslednji dnevi | Shrani |
| pt | Ajustes do widget | Cidade | Cidade de casa | Mostrar | Próximas horas | Próximos dias | Salvar |
| ja | ウィジェットの設定 | 都市 | ホームの都市 | 表示 | この先の数時間 | この先の数日間 | 保存 |
| zh | 小组件设置 | 城市 | 常住城市 | 显示 | 未来几小时 | 未来几天 | 保存 |
| ko | 위젯 설정 | 도시 | 내 도시 | 표시 | 앞으로 몇 시간 | 앞으로 며칠 | 저장 |

### Messages

| | `openOnce` | `pickCity` | `planHike` | `offline` |
|---|---|---|---|---|
| en | Open MetaBlend once to pick a city | Pick a city in MetaBlend | Plan a hike in the app | No connection. Tap to open MetaBlend. |
| de | Öffne MetaBlend einmal, um einen Ort zu wählen | Wähle einen Ort in MetaBlend | Plane eine Tour in der App | Keine Verbindung. Tippen, um MetaBlend zu öffnen. |
| fr | Ouvrez MetaBlend une fois pour choisir une ville | Choisissez une ville dans MetaBlend | Planifiez une randonnée dans l’app | Pas de connexion. Touchez pour ouvrir MetaBlend. |
| es | Abre MetaBlend una vez para elegir una ciudad | Elige una ciudad en MetaBlend | Planifica una excursión en la app | Sin conexión. Toca para abrir MetaBlend. |
| it | Apri MetaBlend una volta per scegliere una città | Scegli una città in MetaBlend | Pianifica un’escursione nell’app | Nessuna connessione. Tocca per aprire MetaBlend. |
| nl | Open MetaBlend één keer om een stad te kiezen | Kies een stad in MetaBlend | Plan een tocht in de app | Geen verbinding. Tik om MetaBlend te openen. |
| pl | Otwórz MetaBlend raz, aby wybrać miasto | Wybierz miasto w MetaBlend | Zaplanuj wędrówkę w aplikacji | Brak połączenia. Dotknij, aby otworzyć MetaBlend. |
| cs | Otevřete jednou MetaBlend a vyberte město | Vyberte město v MetaBlend | Naplánujte si túru v aplikaci | Bez připojení. Klepnutím otevřete MetaBlend. |
| sl | Enkrat odpri MetaBlend in izberi kraj | Izberi kraj v MetaBlendu | Načrtuj turo v aplikaciji | Ni povezave. Tapni, da odpreš MetaBlend. |
| pt | Abra o MetaBlend uma vez para escolher uma cidade | Escolha uma cidade no MetaBlend | Planeje uma trilha no app | Sem conexão. Toque para abrir o MetaBlend. |
| ja | 都市を選ぶには、MetaBlendを一度開いてください | MetaBlendで都市を選んでください | アプリで登山を計画してください | 接続できません。タップしてMetaBlendを開いてください。 |
| zh | 打开一次 MetaBlend 以选择城市 | 在 MetaBlend 中选择城市 | 在应用中计划徒步 | 无网络连接。轻点打开 MetaBlend。 |
| ko | 도시를 고르려면 MetaBlend를 한 번 열어 주세요 | MetaBlend에서 도시를 선택하세요 | 앱에서 등산을 계획해 보세요 | 연결이 없어요. 탭하면 MetaBlend가 열려요. |

The en, de, fr, es and it rows keep today's wording except for the offline message, which used a dash before ("No connection — tap to open MetaBlend").

### After launch: the theme choice (section 11)

Not in this build. Listed here so the translations exist when it comes. On iOS they go into `Localizable.xcstrings`, on Android into `WidgetText.java`.

| | Theme | As in the app | Default | Mono | Winter | Sky |
|---|---|---|---|---|---|---|
| en | Theme | As in the app | Default | Mono | Winter | Sky |
| de | Aussehen | Wie in der App | Standard | Mono | Winter | Himmel |
| fr | Thème | Comme dans l’app | Par défaut | Mono | Hiver | Ciel |
| es | Tema | Como en la app | Predeterminado | Mono | Invierno | Cielo |
| it | Tema | Come nell’app | Predefinito | Mono | Inverno | Cielo |
| nl | Thema | Zoals in de app | Standaard | Mono | Winter | Lucht |
| pl | Motyw | Jak w aplikacji | Domyślny | Mono | Zima | Niebo |
| cs | Motiv | Jako v aplikaci | Výchozí | Mono | Zima | Obloha |
| sl | Tema | Kot v aplikaciji | Privzeta | Mono | Zima | Nebo |
| pt | Tema | Como no app | Padrão | Mono | Inverno | Céu |
| ja | テーマ | アプリと同じ | 標準 | モノクロ | 冬 | 空 |
| zh | 主题 | 与应用相同 | 默认 | 单色 | 冬季 | 天空 |
| ko | 테마 | 앱과 같게 | 기본 | 모노 | 겨울 | 하늘 |

The theme names are the app's own names for the three icons, so the widget and the icon picker under More say the same word.

## 11. After launch: a theme per widget (not in this build)

- **The choice:** "Theme" / "Aussehen" with As in the app (the default), Default, Mono, Winter, Sky (German: Wie in der App, Standard, Mono, Winter, Himmel). "As in the app" follows section 1.
- **Where:**
  - iPhone: a `WidgetTheme` parameter in `WeatherConfig` and `HikeConfig`, shown in Edit Widget.
  - Android: a row of five swatches in `WidgetConfigActivity`, the selection outlined in gold, stored per widget in `WidgetStore` as `theme`.
- **Mockup:** the last section of `widgets.html`.
- The labels in all 13 languages are in section 10.

## 12. Checks before the build goes out

- **Every theme and appearance:** each widget in Default, Mono, Winter and Sky, dark and light, on an iPhone simulator and an Android emulator, compared with `widgets.html`. Include German, where "Gewitterrisiko: gering" takes two lines in the hike widget's right column.
- **Theme switch:** switching the app icon under More to Mono, Winter, Sky, then Slate changes the widgets within seconds, with no new setting anywhere.
- **Tinted, clear and StandBy (iOS):** no scenery, everything legible.
- **Window states:** a hike with a favourable window, with none, beyond tomorrow, and with storm data missing (window in ink).
- **Languages:** switch the app to each of the 13 languages and check the widget texts and the Android settings screen. Japanese, Korean and Chinese must not show English rows.
- **Old builds:** a build without these changes still shows its widgets after the server deploy, because the new fields are only additions.

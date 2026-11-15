# Launch post, 15 December 2026

Instagram carousel (5 slides, 1080 × 1350, German and English) and captions for the launch. Rene posts it on launch day. Nothing here goes to the website.

## Rene: the slide 4 screenshots

Slide 4 ("Alerts and widgets") needs two screenshots from your phone per language. Alerts and widgets exist only in the app, so the website can't show them.

Put them in this folder, under exactly these names:

| File | What it shows |
| --- | --- |
| `store/social/launch-2026-12-15/rene/alerts-de.png` | The app in German: the More tab, scrolled to "Benachrichtigungen" with the alert switches in view |
| `store/social/launch-2026-12-15/rene/widgets-de.png` | A home screen with the MetaBlend city widget and hike widget, app language German |
| `store/social/launch-2026-12-15/rene/alerts-en.png` | The same in English: More tab, "Notifications" |
| `store/social/launch-2026-12-15/rene/widgets-en.png` | The same home screen, app language English |

- Use an iPhone or an Android phone in dark mode, with the screenshot taken in full and not cropped. Both phones save screenshots as PNG, so keep the file as it is and only rename it.
- Use Lienz or another place in Osttirol in the widgets.
- If only one language is posted, that language's two files are enough.
- Commit and push them to this branch:

```
git fetch origin
git checkout social/launch-2026-12-15
git pull --no-edit
git add store/social/launch-2026-12-15/rene
git commit -m "Launch post: Rene's alert and widget screenshots"
git push origin social/launch-2026-12-15
```

## Retake on 28 November (with the final store run)

In the morning, Alps time, so that the peak has a summit window today:

```
node scripts/brand/launch-screens.mjs
node scripts/brand/launch-slides.mjs
```

- Slide 1 is the forecast for Lienz. Slide 3 is Hochstein, or Spitzkofel if Hochstein has no favourable window that day (owner, 2026-11-15). Both are real production screens.
- The slides go to `slides/<lang>-<n>.png`. Slide 4 uses Rene's files once they are in `rene/` and shows dashed placeholders until then.
- The words are the store listing's own (`fastlane/metadata`). Gold appears only in the wordmark, and the stores' badges are unaltered.

## Captions

English:

```
MetaBlend is out today.

One forecast from up to 20 weather sources, and how much they agree. Sources that keep getting your region right count for more.

Summit forecasts worldwide, alerts and widgets. No account, no ads, free. In 13 languages.

On the App Store and Google Play, and at metablend.app
```

Deutsch:

```
MetaBlend ist ab heute da.

Eine Vorhersage aus bis zu 20 Wetterquellen, und wie einig sie sich sind. Quellen, die in deiner Region immer wieder richtig liegen, zählen mehr.

Gipfelprognosen weltweit, Hinweise und Widgets. Kein Konto, keine Werbung, kostenlos. In 13 Sprachen.

Im App Store und bei Google Play, und auf metablend.app
```

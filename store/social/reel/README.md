# Reel "MetaBlend has a new look"

Two films for Instagram Reels and TikTok, English and German, each also as a Reduce Motion version (owner's brief of 21 November 2026, restructured on 22 November, final run of 23 November). Rene checks them on `check.html` and posts them. Nothing here goes to the website.

| File | What it is |
| --- | --- |
| `metablend-new-look-en.mp4`, `metablend-new-look-de.mp4` | The films: 1080 x 1920, 60 fps, 24.0 s, H.264 tagged bt709, no sound |
| `metablend-new-look-en-reduced-motion.mp4`, `…-de-reduced-motion.mp4` | The same films with every change one plain fade and no camera moves |
| `metablend-new-look-en-cover.png`, `metablend-new-look-de-cover.png` | The covers: the frame at one second, the title alone |
| `contact-sheet-en.png`, `contact-sheet-de.png` | Sixteen frames of each film, taken from the rendered file |
| `shots/<stage>-<screen>-<lang>.png` | The stage screenshots, 1170 x 2532 (390 x 844 at 3x), for the carousel too |
| `shots/film/` | The film's pictures (320 px taller), the Before page on Slate, and `regions.json`, where each picture's parts are |
| `check.html` | The films, contact sheets, covers and screenshots on one page |

## The film

| From | What happens |
| --- | --- |
| 0 s | The title alone on Slate |
| 2.05 s | The phone rises in, showing Before |
| 4.7 s | Before to Slate: only the background dissolves, everything else stands still |
| 7.6 s | Slate to Now: only the parts that changed fade out and in, top to bottom |
| 10.5 s | Close-up on the place line, 2.5 s: "Tap the place to change it" / "Zum Wechseln auf den Ort tippen" |
| 14.95 s | Push to the summit page, Week tab, Now only |
| 17.05 s | Close-up on the best day, 2.5 s: "Best day at a glance" / "Bester Tag auf einen Blick" |
| 21.45 s | The end card, its words held 2 s |

The close-ups are 780 px wide, centred on x 540, and end before the strip Reels and TikTok cover from x 940. The first close-up was the row of labelled buttons until 22 November; production's forecast no longer has it (the place's name opens Change place), and the owner chose the place line on 23 November.

## The three stages

| Stage | Source | What it shows |
| --- | --- | --- |
| `1-before` | `48603a1` (7 November), local build | The last commit whose page wore the weather sky, its sunrise switched on (`SKY=dawn`: the sky followed the hour) |
| `2-slate` | `37fb3d5` (7 November), local build | The switch to solid Slate `#0f151b`, nothing else changed |
| `3-now` | production, main `09bd252a` (the tenth deploy) | The forecast with the place line, the summit page's Week tab with the best day, the first start |

Screens: the forecast for Vienna (in English the landing page's own example address, in German "Wien"), Schneeberg (Klosterwappen) on its Tomorrow and Week tabs, and for `3-now` the first start. App view, dark, a drawn status bar that reads 18:41. The older pages had no best day line on the Week tab.

All three show the same weather: production's answers were recorded on 23 November 2026 at 00:38 (Vienna time) while `3-now` was pictured, and the two local builds were given them and asked nothing (`REPLAY`, below); the browser's clock stood still at the recording. Production's CDN had none of the Vienna answers after the deploy at 00:04, so the recording made production ask its sources once: 22 requests to Open-Meteo and 3 each to met.no, OpenWeatherMap, WeatherAPI and Visual Crossing in those minutes (Vercel's metrics, other visitors included).

## Taking the pictures again

`3-now` from production, recording its answers (the file must not exist yet), then the older stages one local build at a time, in a worktree of their own:

```
REPLAY=<answers.json> node scripts/brand/reel-shots.mjs 3-now - https://metablend.app
git worktree add --detach ../reel-stage 37fb3d5
cp <main checkout>/.env.local ../reel-stage/
cd ../reel-stage && npm ci && npx next build
SELF_BASE=http://localhost:3261 npx next start -p 3261
```

Then, from this checkout, with the server of that stage running:

```
REPLAY=<answers.json> ONLY=forecast,peak node scripts/brand/reel-shots.mjs 2-slate ../reel-stage
REPLAY=<answers.json> ONLY=forecast,peak SKY=dawn node scripts/brand/reel-shots.mjs 1-before ../reel-stage
```

- With an existing `REPLAY` file a stage asks nothing: an address the recording lacks fails in the page and is named at the end. Production is allowed for `3-now` only, and only with `REPLAY`.
- Stop the server before the next stage, check out the next commit, run `npm ci` when the lockfile differs, delete `.next` and build again. The script refuses a server that answers from another build than the folder's.
- The builds of `48603a1` and `37fb3d5` end with exit 1 and a notice about their Next.js version. The build itself is complete.

## Rendering the films

The films are made with Remotion in the separate project `my-video` (`src/NewLook.tsx`, texts in `src/newLookProps.ts`):

```
node scripts/render-new-look.mjs <path to this folder>              # films, covers, Reduce Motion films
node scripts/check-new-look-zoom.mjs <path to this folder> --film   # the close-ups measured in the films
```

The render script checks the texts first (no dashes, none of the words the copy rules forbid) and reads the pictures from `shots/`. The check fails when a close-up's centre is more than 2 px off, reaches x 940, or the phone's sides differ by more than 3 px.

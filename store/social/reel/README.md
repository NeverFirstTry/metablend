# Reel "MetaBlend has a new look"

Two films for Instagram Reels and TikTok, English and German (owner's brief of 21 November 2026). Rene checks them on `check.html` and posts them. Nothing here goes to the website.

| File | What it is |
| --- | --- |
| `metablend-new-look-en.mp4`, `metablend-new-look-de.mp4` | The films: 1080 x 1920, 30 fps, 19.9 s, H.264, no sound |
| `metablend-new-look-en-cover.png`, `metablend-new-look-de-cover.png` | The covers: the frame at one second, the title over the new look |
| `shots/<stage>-<screen>-<lang>.png` | The stage screenshots, 1170 x 2532 (390 x 844 at 3x), for the carousel too |
| `check.html` | Both films, the covers and the screenshots on one page |

## The three stages

| Stage | Commit | What it shows |
| --- | --- | --- |
| `1-before` | `48603a1` (7 November) | The last commit whose page wore the weather sky. `311cabc` took the sunrise out and `37fb3d5` made the background Slate six minutes later, so the parent of the Slate commit already had a plain navy background. |
| `2-slate` | `50bc282` (17 November) | Solid Slate `#0f151b` with gold, before the UX changes of 20 November |
| `3-now` | `967e434` (21 November) | Main: the first start, the search field with labelled buttons, the peak's Week tab with the best day |

Screens: the forecast for Lienz, Hochstein's Tomorrow and Week tabs, and for `3-now` the first start. App view, dark, a drawn status bar that reads 18:41. All taken on 21 November 2026 between 21:44 and 21:57 from local builds on the dev database, so the three stages show the same weather.

The Before pictures have their sunrise sky switched on (`SKY=dawn`): the old sky followed the hour, and at night it was navy.

## Taking the pictures again

One build at a time, in a worktree of its own:

```
git worktree add --detach ../reel-stage 48603a1
cp <main checkout>/.env.local ../reel-stage/
cd ../reel-stage && npm ci && npx next build
SELF_BASE=http://localhost:3261 npx next start -p 3261
```

Then, from this checkout:

```
SKY=dawn node scripts/brand/reel-shots.mjs 1-before ../reel-stage
node scripts/brand/reel-shots.mjs 2-slate ../reel-stage
node scripts/brand/reel-shots.mjs 3-now ../reel-stage
```

- Stop the server before the next stage, check out the next commit, run `npm ci` when the lockfile differs, delete `.next` and build again. The script refuses a server that answers from another build than the folder's.
- The build of `48603a1` ends with exit 1 and a notice about its Next.js version (16.4.3). The build itself is complete; main is on 16.4.5.
- `3-now`: a build made while no server answers has a start page without its Vienna example, and the first start is then pictured without it. Before the pictures, stop the server, delete `index.*` under `.next/server/app/` and under `.next/server/route-cache/`, start it again and ask `/` once.

## Rendering the films

The films are made with Remotion in the separate project `my-video` (`src/NewLook.tsx`, texts in `src/newLookProps.ts`):

```
node scripts/render-new-look.mjs <path to this folder>            # both films and covers
node scripts/render-new-look.mjs <path to this folder> --stills   # frames to look at
```

The script checks the texts first (no dashes, none of the words the copy rules forbid) and reads the pictures from `shots/`.

## Version 2, in work (owner's feedback of 21 November: no wipes, one stage turns into the next part by part)

Not rendered yet: the films, covers and pictures above are still version 1. The final run waits for the owner's word that main carries UX batches 5 to 7 and the gold rule.

- `scripts/brand/reel-shots.mjs` now also writes `shots/film/`: every screen 320 px taller, `1-before-on-slate-…` (the old page on Slate, so the film can change the background first) and `regions.json` (where each picture's parts are: header, search row, headline, tabs, first card, the rest, tab bar). The parts are read from the page, so a new layout needs no numbers by hand.
- The film (`my-video`, branch `new-look-reel`) cross-fades the parts top to bottom, 13 frames each, 8 frames apart, the sky first. Summit page: the Week tab, where the best day's line grows in. Two quiet words beside what is new ("Labelled buttons", "Best day at a glance"), one close-up (the first start), and a reduced motion version (`…-reduced-motion.mp4`, every change one fade).
- For the final run: all three stages again in the same quarter hour (the weather has to match), then `node scripts/render-new-look.mjs <this folder>`, look at the frames (`--stills`), update `check.html`, push once.

# Widget design

The home-screen widgets' approved look (owner, 2026-11-16). The spec for the native build is `docs/widgets-spec.md`.

- `widgets.html`: the mockups. Open it in a browser. City and hike widget, iPhone and Android, the default and the Mono, Winter and Sky themes, dark and light, German and English.
- `assets/`: the icons and the theme scenery as SVG for the native build (lucide, ISC licence in `assets/LICENSE-lucide.txt`).
- `data/`: production's widget answers for Lienz and the Hochstein hike on 16 November, which the mockups show.
- `i/`: today's widgets on an iPhone, for comparison.

Regenerate with `node scripts/brand/widget-mockups.mjs`.

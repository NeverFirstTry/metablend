// The site's dark look on share cards (app/opengraph-image.js, app/[lang]/opengraph-image.js, /api/og/city):
// solid Slate, the faint gold glow where the sun is (the page's --glow in app/globals.css: east at sunrise,
// overhead by day, warmer in the west at sunset, none at night or in bad weather), gold the only accent.
export const OG = { slate: '#0f151b', ink: '#f6f8fc', muted: 'rgba(226, 234, 247, 0.78)', faint: 'rgba(226, 234, 247, 0.62)', gold: '#ffd98a' }

// a card is seen small, so the glow is a little stronger than on the page (17 / 15 / 20 %)
const GLOW = {
  dawn: 'radial-gradient(75% 95% at 0% 0%, rgba(255, 217, 138, 0.22), rgba(255, 217, 138, 0) 70%)',
  day: 'radial-gradient(90% 55% at 50% 0%, rgba(255, 217, 138, 0.18), rgba(255, 217, 138, 0) 75%)',
  dusk: 'radial-gradient(75% 95% at 100% 0%, rgba(255, 196, 112, 0.24), rgba(255, 196, 112, 0) 70%)',
}
// the card's background for a sky (lib/sky.js skyFor); any other sky: plain Slate
export const ogBackground = sky => ({ backgroundColor: OG.slate, ...(GLOW[sky] ? { backgroundImage: GLOW[sky] } : {}) })

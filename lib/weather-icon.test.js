// The "Wetter" app icon (owner, 2026-11-28, his sketch): a wide, flat cloud on a straight base with the sun rising
// behind its top right, one gold only (#ffd98a on Slate), no letters; its light, dark and tinted looks for iPhone.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { ICONS, iconArt } = await import('../scripts/brand/icons.mjs')
const weather = ICONS.find(i => i.id === 'weather')

test('the Wetter icon: the sun in the one gold on Slate, a cloud, no letters, no second gold', () => {
  const art = iconArt(weather, 'icon')
  assert.match(art, /fill="#0f151b"/, 'Slate behind')
  assert.match(art, /fill="#ffd98a"/, 'the gold sun')
  assert.doesNotMatch(art, /#a86e00/i, 'no dark gold (it clashed with the sun)')
  assert.doesNotMatch(art, /<path d="M[^"]{200,}/, 'no letter outlines (they were too small to read at 60 px)')
  // the base is one path ending in its own arc, so no seam shows where shapes would meet at a point
  assert.match(art, /<path d="M27 74H75a7 7 0 0 0 0-14H27z"\/>/)
})

test('it has its dark and tinted looks for iPhone', () => {
  assert.match(iconArt(weather, 'dark'), /fill="#dfe5ee"/, 'the dark look\'s dimmer cloud')
  assert.doesNotMatch(iconArt(weather, 'dark'), /fill="#0f151b"/, 'no Slate: iOS draws its own dark tile')
  assert.match(iconArt(weather, 'tinted'), /fill="#000"/, 'the tinted look on black')
})

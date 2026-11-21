// Every button, chip and tab is at least 44 px high on a touch screen (UX review X2, owner: before launch: 79
// controls in the app view were under it, used with a thumb, often outdoors and in gloves). One rule beside the
// one the Recent chips already had; small text links in running text (credits, legal) stay as they are.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const coarse = [...css.matchAll(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n')

// source-match-ok: a style sheet rule; what it does to each control is measured by scripts/ux/walk.mjs on phone configurations
test('on touch screens buttons, tabs, pickers and chip links get 44 px, and the map zoom too', () => {
  assert.match(coarse, /main button, main \[role="tab"\], main select, \.tap-target \{ min-height: 44px; \}/)
  assert.match(coarse, /\.leaflet-touch \.leaflet-bar a \{ width: 44px; height: 44px; line-height: 44px; \}/)
})

// source-match-ok: the summit chips on the mountain list are links, so they carry the class the rule names
test('the summit chips on the mountain list carry the touch class', () => {
  assert.match(readFileSync(new URL('../app/mountains/MountainList.jsx', import.meta.url), 'utf8'), /className="tap-target press inline-flex items-center/)
})

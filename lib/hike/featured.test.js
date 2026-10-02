import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { REGIONS, checkPeak } from './featured-list.js'

const featured = JSON.parse(fs.readFileSync(new URL('./featured.json', import.meta.url)))

// the ids that existed before the list grew: plans, widgets and links use them
const OLD_IDS = ['grossglockner', 'wildspitze', 'grossvenediger', 'olperer', 'kitzsteinhorn', 'hoher-dachstein', 'hochkoenig',
  'hafelekarspitze', 'hochschwab', 'patscherkofel', 'schneeberg', 'rax', 'oetscher', 'schafberg', 'traunstein',
  'erzherzog-johann-huette', 'schiestlhaus', 'zugspitze', 'watzmann', 'alpspitze', 'wendelstein', 'herzogstand',
  'dufourspitze', 'matterhorn', 'jungfrau', 'piz-bernina', 'eiger', 'titlis', 'saentis', 'pilatus', 'rigi',
  'hoernlihuette', 'gran-paradiso', 'ortler', 'marmolada', 'tre-cime', 'rifugio-auronzo', 'mont-blanc',
  'aiguille-du-midi', 'refuge-du-gouter', 'triglav']

test('featured.json — every entry valid, ~200 of them, every region filled, old ids kept', () => {
  const seen = new Set()
  for (const p of featured) assert.equal(checkPeak(p, seen), null)
  assert.ok(featured.length >= 190, `${featured.length} entries`)
  for (const r of REGIONS) assert.ok(featured.some(p => p.region === r), `region ${r} is empty`)
  for (const id of OLD_IDS) assert.ok(seen.has(id), `${id} is gone`)
})

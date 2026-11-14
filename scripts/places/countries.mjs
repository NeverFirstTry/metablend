// Step 1b of the summits dataset: which country each summit and hut lies in, from OpenStreetMap's own
// country boundaries. The Overpass service is asked, six countries a question, for the ids of the peaks,
// volcanoes and huts inside each country's area, so a summit's country is where its position is, not
// where the nearest town happens to be → data/places/countries/<CC>.json, and how it went in
// data/places/countries-summary.json. A country done is skipped, so a broken run picks up where it
// stopped. One question at a time with a pause between them. Nothing of ours is sent: a question holds
// the numbers of OpenStreetMap's boundary relations and nothing else.
//   node scripts/places/countries.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { areasQuery, areasAnswer, countriesOf } from '../../lib/places/plan.js'

const DIR = join('data', 'places', 'countries')
const SERVER = 'https://overpass-api.de/api/interpreter'
const TRIES = 10, PAUSE_MS = 5000, AT_ONCE = 6 // patient: the public server is often "at capacity" for minutes
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(DIR, { recursive: true })

// one question; null when the server did not answer it in full after a few tries
async function ask(ql, read) {
  for (let i = 0; i < TRIES; i++) {
    let why
    try {
      const res = await fetch(SERVER, { method: 'POST', headers: { 'User-Agent': 'places-refresh/1', 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(ql)}`, signal: AbortSignal.timeout(1_000_000) })
      const got = res.ok ? read(await res.json()) : null
      if (got) return got
      why = res.ok ? 'an answer cut short or from old data' : `HTTP ${res.status}`
    } catch (e) { why = e.message }
    console.log(`   try ${i + 1}: ${why}`)
    if (i < TRIES - 1) await sleep(Math.min(120_000, 30_000 * (i + 1)))
  }
  return null
}

const countries = await ask('[out:json][timeout:180];rel["ISO3166-1"~"^[A-Z][A-Z]$"]["boundary"="administrative"];out ids tags;', countriesOf)
if (!countries || countries.length < 200) {
  console.error(`Not asked: the list of countries ${countries ? `has only ${countries.length} entries` : 'did not come'}.`)
  process.exit(1)
}

const file = cc => join(DIR, `${cc}.json`)
const save = (cc, ids) => { writeFileSync(file(cc), JSON.stringify({ cc, ids })); console.log(`${cc}: ${ids.length}`) }
const open = countries.filter(c => !existsSync(file(c.cc)))
const failed = []
for (let i = 0; i < open.length; i += AT_ONCE) {
  const group = open.slice(i, i + AT_ONCE).filter(c => !existsSync(file(c.cc))) // not what a second run did meanwhile
  if (!group.length) continue
  const t0 = Date.now()
  const got = await ask(areasQuery(group), areasAnswer)
  if (got) for (const c of group) save(c.cc, got[c.cc] ?? [])
  else {
    // the six together were too much, or one of them is: each alone
    for (const c of group) {
      await sleep(PAUSE_MS)
      const one = await ask(areasQuery([c]), areasAnswer)
      if (one) save(c.cc, one[c.cc] ?? [])
      else { failed.push(c.cc); console.log(`${c.cc}: no answer`) }
    }
  }
  console.log(`   ${group.map(c => c.cc).join(' ')}: ${Math.round((Date.now() - t0) / 1000)} s`)
  await sleep(PAUSE_MS)
}
const ids = countries.reduce((n, c) => n + (existsSync(file(c.cc)) ? JSON.parse(readFileSync(file(c.cc), 'utf8')).ids.length : 0), 0)
writeFileSync(join('data', 'places', 'countries-summary.json'), JSON.stringify({ finished: true, countries: countries.length, failed, ids }, null, 1))
console.log(`country areas: ${countries.length - failed.length} of ${countries.length} answered, ${ids} summits and huts in them${failed.length ? `; no answer for ${failed.join(', ')}: their summits are filed by the nearest town` : ''}`)
if (failed.length) process.exit(1)

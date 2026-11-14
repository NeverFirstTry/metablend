// Step 1b of the summits dataset: which country each summit and hut lies in, from OpenStreetMap's own
// country boundaries. An Overpass server is asked, one country a request, for the ids of the peaks,
// volcanoes and huts inside that country's area, so a summit's country is where its position is, not
// where the nearest town happens to be → data/places/countries/<CC>.json, and how it went in
// data/places/countries-summary.json. A country done is skipped, so a run that stopped picks up where
// it stopped. Nothing of ours is sent but who asks: a question holds the number of one of
// OpenStreetMap's boundary relations and nothing else.
//   node scripts/places/countries.mjs
//
// The server is the one OpenStreetMap France runs. It publishes no rules of its own, so the main
// server's are kept, and the owner's of 2026-11-14 on top (the main server, overpass-api.de, was asked
// by two workers that day with six countries a question, answered "at capacity" for hours and then
// reset every connection from this address):
//   - one request at a time, and never a second run beside this one;
//   - a User-Agent that says who asks and how to reach us;
//   - a pause after every country, as long as its answer took (at least 10 s);
//   - on a refusal (429, 504, any other failure) a wait of 1, 2 and 4 minutes, or what the server names;
//   - still refused after that: THE RUN STOPS (exit 2) and says so. No other server is tried: stop and
//     tell the owner (the main server's rules: "use extracts if you need a lot of data"; a run is about
//     250 requests and 25 MB, twice a year).
// An answer from old data counts as a refusal (lib/places/plan.js areasAnswer): one public server
// answered on 2026-11-14 from data four months old.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { areasQuery, areasAnswer, countriesOf } from '../../lib/places/plan.js'

const DIR = join('data', 'places', 'countries')
const SERVER = 'https://overpass.openstreetmap.fr/api/interpreter'
const UA = 'MetaBlend/1.0 places refresh (https://metablend.app; info@metablend.app)'
const WAITS_MS = [60_000, 120_000, 240_000], PAUSE_MS = 10_000
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(DIR, { recursive: true })

// One question, asked again after each wait while the server refuses. Throws when it still refuses.
async function ask(ql, read, what) {
  for (let i = 0; ; i++) {
    let why, wait = WAITS_MS[i]
    try {
      const res = await fetch(SERVER, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(ql)}`, signal: AbortSignal.timeout(1_000_000) })
      const got = res.ok ? read(await res.json()) : null
      if (got) return got
      why = res.ok ? 'an answer cut short or from old data' : `HTTP ${res.status}`
      const named = Number(res.headers.get('retry-after')) * 1000
      if (wait && named > wait) wait = Math.min(named, 900_000)
    } catch (e) { why = e.message }
    if (!wait) throw new Error(`${what}: ${why}, and the same after ${WAITS_MS.length} waits`)
    console.log(`   ${what}: ${why}; waiting ${wait / 1000} s`)
    await sleep(wait)
  }
}

try {
  const countries = await ask('[out:json][timeout:180];rel["ISO3166-1"~"^[A-Z][A-Z]$"]["boundary"="administrative"];out ids tags;', countriesOf, 'the list of countries')
  if (countries.length < 200) throw new Error(`the list of countries has only ${countries.length} entries`)
  const file = cc => join(DIR, `${cc}.json`)
  const open = countries.filter(c => !existsSync(file(c.cc)))
  console.log(`${countries.length} countries, ${open.length} still to ask`)
  for (const c of open) {
    await sleep(PAUSE_MS)
    const t0 = Date.now()
    const ids = (await ask(areasQuery([c]), areasAnswer, c.cc))[c.cc] ?? []
    const took = Date.now() - t0
    writeFileSync(file(c.cc), JSON.stringify({ cc: c.cc, ids }))
    console.log(`${c.cc}: ${ids.length} in ${Math.round(took / 1000)} s`)
    if (took > PAUSE_MS) await sleep(took - PAUSE_MS) // with the pause before the next one: as long as the answer took
  }
  const ids = countries.reduce((n, c) => n + JSON.parse(readFileSync(file(c.cc), 'utf8')).ids.length, 0)
  writeFileSync(join('data', 'places', 'countries-summary.json'), JSON.stringify({ finished: true, countries: countries.length, failed: [], ids }, null, 1))
  console.log(`country areas: all ${countries.length} answered, ${ids} summits and huts in them`)
} catch (e) {
  console.error(`Stopped: ${e.message}. The server refuses: nothing more is asked. What is done stays; run this again later (it skips what is done), and tell the owner before trying another server.`)
  process.exit(2)
}

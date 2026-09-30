// Records trimmed real API responses into lib/hike/__fixtures__/ for the
// hiking engine tests. Re-run when an upstream format changes:
//   node scripts/record-hike-fixtures.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OM_MODELS } from '../lib/outlook/models.js'
import { SUMMIT_HOURLY } from '../lib/hike/parse.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'hike', '__fixtures__')
fs.mkdirSync(OUT, { recursive: true })
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }
async function get(url) {
  const r = await fetch(url, { headers: UA })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}
function save(name, data) {
  const s = JSON.stringify(data)
  fs.writeFileSync(path.join(OUT, name), s)
  console.log(name.padEnd(28), `${(s.length / 1024).toFixed(0)} kB`)
}

const models = OM_MODELS.map(m => m.model).join(',')
save('om-summit-glockner.json', await get(`https://api.open-meteo.com/v1/forecast?latitude=47.0745&longitude=12.6945&elevation=3798&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${models}&forecast_days=3&timezone=auto`))
const photon = await get('https://photon.komoot.io/api/?q=Schneeberg&osm_tag=natural:peak&osm_tag=natural:volcano&osm_tag=tourism:alpine_hut&limit=15&lat=47.8&lon=15.8')
save('photon-schneeberg.json', photon)

// OpenStreetMap tags (for `ele`) of exactly those hits, via Overpass
const byType = { N: 'node', W: 'way', R: 'relation' }, ids = { node: [], way: [], relation: [] }
for (const f of photon.features) ids[byType[f.properties.osm_type]].push(f.properties.osm_id)
const query = `[out:json][timeout:8];(${Object.entries(ids).filter(([, a]) => a.length).map(([t, a]) => `${t}(id:${a.join(',')});`).join('')});out tags;`
let tags = null
for (const host of ['https://overpass-api.de', 'https://overpass.private.coffee', 'https://overpass-api.de', 'https://overpass.private.coffee']) {
  try {
    const op = await fetch(`${host}/api/interpreter`, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(20000) })
    if (op.ok) { tags = await op.json(); break }
    console.log(`overpass ${host} → ${op.status}, retrying`)
  } catch (e) { console.log(`overpass ${host} → ${e.name}, retrying`) }
  await new Promise(r => setTimeout(r, 3000))
}
if (!tags) throw new Error('overpass unavailable')
save('overpass-schneeberg.json', tags)
save('elevation-3.json', await get('https://api.open-meteo.com/v1/elevation?latitude=47.7675,47.0745,46.3783&longitude=15.8069,12.6945,13.8367'))
save('geocoding-zugspitze.json', await get('https://geocoding-api.open-meteo.com/v1/search?name=Zugspitze&count=20&language=en'))

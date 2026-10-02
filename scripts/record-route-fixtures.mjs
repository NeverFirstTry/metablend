// Records trimmed real responses into lib/route/__fixtures__/ for the route
// engine tests. Re-run when an upstream format changes:
//   node scripts/record-route-fixtures.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUMMIT_HOURLY } from '../lib/hike/parse.js'
import { CORE_MODELS } from '../lib/outlook/models.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'route', '__fixtures__')
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
  console.log(name.padEnd(26), `${(s.length / 1024).toFixed(0)} kB`)
}

// Großglockner's summit box (the same box findRoutes asks for), trimmed to the
// hiking relations, their ways, those ways' nodes and the summit
const map = await get('https://api.openstreetmap.org/api/0.6/map.json?bbox=12.68510,47.06850,12.70310,47.08050')
const rels = map.elements.filter(e => e.type === 'relation' && /^(hiking|foot|mountain_hiking)$/.test(e.tags?.route ?? ''))
const wayIds = new Set(rels.flatMap(r => r.members.filter(m => m.type === 'way').map(m => m.ref)))
const ways = map.elements.filter(e => e.type === 'way' && wayIds.has(e.id))
const nodeIds = new Set(ways.flatMap(w => w.nodes))
const nodes = map.elements.filter(e => e.type === 'node' && (nodeIds.has(e.id) || e.tags?.natural === 'peak'))
save('osm-glockner-map.json', { elements: [...nodes, ...ways, ...rels] })
// 712 Alter Kalser Weg (the Normalweg via Stüdlhütte)
save('osm-712-full.json', await get('https://api.openstreetmap.org/api/0.6/relation/14622955/full.json'))
// three points up the 712 (Lucknerhaus, Stüdlhütte, summit) for the multi-point weather request
const PTS = [[47.0172, 12.6913, 1920], [47.0603, 12.6779, 2802], [47.0745, 12.6941, 3798]]
save('om-route-3pt.json', await get(`https://api.open-meteo.com/v1/forecast?latitude=${PTS.map(p => p[0]).join(',')}&longitude=${PTS.map(p => p[1]).join(',')}&elevation=${PTS.map(p => p[2]).join(',')}&hourly=${SUMMIT_HOURLY.join(',')}&daily=sunrise,sunset&models=${CORE_MODELS.join(',')}&forecast_days=3&timezone=auto`))

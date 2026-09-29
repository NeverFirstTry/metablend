// Builds lib/hike/featured.json: hand-picked Alps peaks and huts with their
// published heights. Exact coordinates come from OpenStreetMap via Photon —
// the match nearest the rough hint, within 3 km. Re-run after editing LIST:
//   node scripts/build-featured-peaks.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { haversineKm } from '../lib/geo.js'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'hike', 'featured.json')
const UA = { 'User-Agent': 'MetaBlend/1.0 github.com/NeverFirstTry/metablend' }

// [id, display name, OSM search text, hint lat, hint lon, height m, country, kind, aka]
const LIST = [
  ['grossglockner', 'Großglockner', 'Großglockner', 47.0745, 12.6945, 3798, 'AT', 'peak', ['Grossglockner']],
  ['wildspitze', 'Wildspitze', 'Wildspitze', 46.885, 10.867, 3768, 'AT', 'peak'],
  ['grossvenediger', 'Großvenediger', 'Großvenediger', 47.109, 12.346, 3657, 'AT', 'peak', ['Grossvenediger']],
  ['olperer', 'Olperer', 'Olperer', 47.052, 11.662, 3476, 'AT', 'peak'],
  ['kitzsteinhorn', 'Kitzsteinhorn', 'Kitzsteinhorn', 47.188, 12.687, 3203, 'AT', 'peak'],
  ['hoher-dachstein', 'Hoher Dachstein', 'Hoher Dachstein', 47.475, 13.606, 2995, 'AT', 'peak', ['Dachstein']],
  ['hochkoenig', 'Hochkönig', 'Hochkönig', 47.420, 13.062, 2941, 'AT', 'peak', ['Hochkoenig']],
  ['hafelekarspitze', 'Hafelekarspitze (Nordkette)', 'Hafelekarspitze', 47.312, 11.386, 2334, 'AT', 'peak', ['Nordkette']],
  ['hochschwab', 'Hochschwab', 'Hochschwab', 47.618, 15.142, 2277, 'AT', 'peak'],
  ['patscherkofel', 'Patscherkofel', 'Patscherkofel', 47.209, 11.461, 2246, 'AT', 'peak'],
  ['schneeberg', 'Schneeberg (Klosterwappen)', 'Klosterwappen', 47.767, 15.807, 2076, 'AT', 'peak', ['Schneeberg']],
  ['rax', 'Rax (Heukuppe)', 'Heukuppe', 47.689, 15.689, 2007, 'AT', 'peak', ['Rax', 'Raxalpe']],
  ['oetscher', 'Ötscher', 'Ötscher', 47.863, 15.201, 1893, 'AT', 'peak', ['Oetscher']],
  ['schafberg', 'Schafberg', 'Schafberg', 47.776, 13.434, 1783, 'AT', 'peak'],
  ['traunstein', 'Traunstein', 'Traunstein', 47.873, 13.834, 1691, 'AT', 'peak'],
  ['erzherzog-johann-huette', 'Erzherzog-Johann-Hütte', 'Erzherzog-Johann-Hütte', 47.069, 12.697, 3454, 'AT', 'hut', ['Adlersruhe', 'Erzherzog Johann Huette']],
  ['schiestlhaus', 'Schiestlhaus', 'Schiestlhaus', 47.622, 15.148, 2153, 'AT', 'hut'],
  ['zugspitze', 'Zugspitze', 'Zugspitze', 47.421, 10.985, 2962, 'DE', 'peak'],
  ['watzmann', 'Watzmann (Mittelspitze)', 'Watzmann', 47.555, 12.922, 2713, 'DE', 'peak', ['Watzmann']],
  ['alpspitze', 'Alpspitze', 'Alpspitze', 47.414, 11.052, 2628, 'DE', 'peak'],
  ['wendelstein', 'Wendelstein', 'Wendelstein', 47.703, 12.012, 1838, 'DE', 'peak'],
  ['herzogstand', 'Herzogstand', 'Herzogstand', 47.614, 11.308, 1731, 'DE', 'peak'],
  ['dufourspitze', 'Dufourspitze (Monte Rosa)', 'Dufourspitze', 45.937, 7.867, 4634, 'CH', 'peak', ['Monte Rosa']],
  ['matterhorn', 'Matterhorn', 'Matterhorn', 45.976, 7.658, 4478, 'CH', 'peak', ['Cervino']],
  ['jungfrau', 'Jungfrau', 'Jungfrau', 46.537, 7.962, 4158, 'CH', 'peak'],
  ['piz-bernina', 'Piz Bernina', 'Piz Bernina', 46.382, 9.908, 4049, 'CH', 'peak'],
  ['eiger', 'Eiger', 'Eiger', 46.577, 8.005, 3967, 'CH', 'peak'],
  ['titlis', 'Titlis', 'Titlis', 46.772, 8.437, 3238, 'CH', 'peak'],
  ['saentis', 'Säntis', 'Säntis', 47.249, 9.343, 2502, 'CH', 'peak', ['Saentis']],
  ['pilatus', 'Pilatus (Tomlishorn)', 'Tomlishorn', 46.974, 8.253, 2128, 'CH', 'peak', ['Pilatus']],
  ['rigi', 'Rigi Kulm', 'Rigi', 47.056, 8.485, 1798, 'CH', 'peak', ['Rigi']],
  ['hoernlihuette', 'Hörnlihütte', 'Hörnlihütte', 45.982, 7.674, 3260, 'CH', 'hut', ['Hornlihutte', 'Hoernlihuette']],
  ['gran-paradiso', 'Gran Paradiso', 'Gran Paradiso', 45.518, 7.266, 4061, 'IT', 'peak'],
  ['ortler', 'Ortler', 'Ortler', 46.509, 10.545, 3905, 'IT', 'peak', ['Ortles']],
  ['marmolada', 'Marmolada (Punta Penia)', 'Punta Penia', 46.434, 11.851, 3343, 'IT', 'peak', ['Marmolada']],
  ['tre-cime', 'Drei Zinnen (Große Zinne)', 'Große Zinne', 46.619, 12.305, 2999, 'IT', 'peak', ['Tre Cime', 'Cima Grande', 'Drei Zinnen']],
  ['rifugio-auronzo', 'Rifugio Auronzo', 'Rifugio Auronzo', 46.612, 12.296, 2320, 'IT', 'hut'],
  ['mont-blanc', 'Mont Blanc', 'Mont Blanc', 45.833, 6.865, 4806, 'FR', 'peak', ['Monte Bianco']],
  ['aiguille-du-midi', 'Aiguille du Midi', 'Aiguille du Midi', 45.879, 6.887, 3842, 'FR', 'peak'],
  ['refuge-du-gouter', 'Refuge du Goûter', 'Refuge du Goûter', 45.851, 6.832, 3835, 'FR', 'hut', ['Gouter']],
  ['triglav', 'Triglav', 'Triglav', 46.378, 13.837, 2864, 'SI', 'peak'],
]

const r5 = v => Math.round(v * 1e5) / 1e5
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function resolve([id, name, query, lat, lon, elev, country, kind, aka]) {
  const tag = kind === 'hut' ? 'tourism:alpine_hut' : 'natural:peak'
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&osm_tag=${tag}&limit=10&lat=${lat}&lon=${lon}`, { headers: UA })
  const features = res.ok ? (await res.json()).features ?? [] : []
  const best = features
    .map(f => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }))
    .map(p => ({ ...p, km: haversineKm(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)[0]
  const ok = best && best.km <= 3
  if (!ok) console.warn(`! ${id}: no OpenStreetMap match within 3 km — keeping the hint`)
  return { id, name, ...(aka ? { aka } : {}), lat: r5(ok ? best.lat : lat), lon: r5(ok ? best.lon : lon), elev, country, kind }
}

const out = []
for (const row of LIST) {
  out.push(await resolve(row))
  await sleep(300) // be fair to the public Photon instance
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} featured peaks → ${path.relative(process.cwd(), OUT)}`)

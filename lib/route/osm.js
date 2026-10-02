// OpenStreetMap routes (pure — unit tested): which hiking relations reach a
// summit, and one relation as an ordered line. Data from the official API
// (map.json for the summit box, relation/{id}/full.json for a route).
import { haversineM } from './geometry.js'

export const SAC = ['hiking', 'mountain_hiking', 'demanding_mountain_hiking', 'alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking']
const ROUTE = /^(hiking|foot|mountain_hiking)$/

// 1 km: Alpine club routes usually end at the last hut below the summit (the
// 712 on the Großglockner stops 660 m short); findRoutes walks on from there
export function routesNear(map, summit, radiusM = 1000) {
  const els = map?.elements ?? []
  const nodes = new Map(els.filter(e => e.type === 'node').map(n => [n.id, n]))
  const ways = new Map(els.filter(e => e.type === 'way').map(w => [w.id, w]))
  const reaches = id => (ways.get(id)?.nodes ?? []).some(nid => { const n = nodes.get(nid); return !!n && haversineM(summit, n) <= radiusM })
  return els
    .filter(e => e.type === 'relation' && ROUTE.test(e.tags?.route ?? '') && e.members?.some(m => m.type === 'way' && reaches(m.ref)))
    .map(r => ({ id: r.id, ref: r.tags.ref ?? null, name: r.tags.name ?? r.tags.loc_name ?? null }))
}

// the route's label: its number and name, without repeating a number the name
// already carries ("Alter Kalser Weg 712"); null when OSM has neither
export function routeLabel({ ref, name }) {
  if (name && ref && name.includes(ref)) return name
  return [ref, name].filter(Boolean).join(' ') || null
}

// member ways joined end to end (reversed where needed); a member that
// touches neither end is appended — OSM relations aren't always contiguous
export function stitch(full) {
  const els = full?.elements ?? []
  const rel = els.find(e => e.type === 'relation')
  if (!rel) return null
  const nodes = new Map(els.filter(e => e.type === 'node').map(n => [n.id, n]))
  const ways = new Map(els.filter(e => e.type === 'way').map(w => [w.id, w]))
  const members = rel.members.filter(m => m.type === 'way' && ways.has(m.ref)).map(m => ways.get(m.ref))
  const segs = members.map(w => w.nodes.slice())
  if (!segs.length) return null
  let chain = segs.shift()
  while (segs.length) {
    const head = chain[0], tail = chain.at(-1)
    let k = segs.findIndex(s => s[0] === tail || s.at(-1) === tail)
    if (k >= 0) { const s = segs.splice(k, 1)[0]; chain = chain.concat((s[0] === tail ? s : s.reverse()).slice(1)); continue }
    k = segs.findIndex(s => s[0] === head || s.at(-1) === head)
    if (k >= 0) { const s = segs.splice(k, 1)[0]; chain = (s.at(-1) === head ? s : s.reverse()).slice(0, -1).concat(chain); continue }
    chain = chain.concat(segs.shift())
  }
  const ranks = members.map(w => SAC.indexOf(w.tags?.sac_scale)).filter(i => i >= 0)
  const t = rel.tags ?? {}
  return {
    id: rel.id, ref: t.ref ?? null, name: t.name ?? t.loc_name ?? null, from: t.from ?? null, to: t.to ?? null,
    symbol: t['osmc:symbol'] ?? null,
    difficulty: ranks.length ? SAC[Math.max(...ranks)] : null,
    points: chain.map(id => nodes.get(id)).filter(Boolean).map(n => ({ lat: n.lat, lon: n.lon, ele: null })),
  }
}

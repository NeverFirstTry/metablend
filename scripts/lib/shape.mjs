// The shape of a JSON answer: every path (keys, and [] for list items) with the types seen there. Two answers
// differ in shape when a key is in one and not the other, or a value changed type (number to string). A difference
// below a null or an empty list is none: a warning that isn't there today, a day without notes.
// Options: maps, objects keyed by data (a source's id), compared by their values only (path.*); optional, keys
// that come and go with the data (the forecast's cached flag).
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v

function paths(v, maps, p = '', out = new Map()) {
  const t = typeOf(v)
  if (!out.has(p)) out.set(p, new Set())
  out.get(p).add(t)
  if (t === 'array') for (const x of v) paths(x, maps, `${p}[]`, out)
  else if (t === 'object') for (const [k, x] of Object.entries(v)) paths(x, maps, `${p}.${maps.includes(p) ? '*' : k}`, out)
  return out
}

// only null, or only lists that are all empty: nothing below it to compare
const hollow = (map, p) => map.has(p) && [...map.get(p)].every(t => t === 'null' || (t === 'array' && !map.has(`${p}[]`)))
const ancestors = p => { const out = []; for (let i = p.length; i > 0; i--) if (p[i] === '.' || p[i] === '[') out.push(p.slice(0, i)); return out }
const excused = (map, p) => ancestors(p).some(a => hollow(map, a))

// the differences, as short lines ('' is the answer itself)
export function shapeDiff(recorded, live, { maps = [], optional = [] } = {}) {
  const a = paths(recorded, maps), b = paths(live, maps), out = []
  const comes = p => optional.some(o => p === o || p.startsWith(`${o}.`) || p.startsWith(`${o}[`))
  for (const p of a.keys()) if (!b.has(p) && !excused(b, p) && !comes(p)) out.push(`${p || 'the answer'} is gone`)
  for (const p of b.keys()) if (!a.has(p) && !excused(a, p) && !comes(p)) out.push(`${p || 'the answer'} is new`)
  for (const [p, t] of a) {
    if (!b.has(p)) continue
    const was = [...t].filter(x => x !== 'null'), now = [...b.get(p)].filter(x => x !== 'null')
    if (was.length && now.length && !was.some(x => now.includes(x))) out.push(`${p} was ${was.join('/')}, now ${now.join('/')}`)
  }
  return out
}

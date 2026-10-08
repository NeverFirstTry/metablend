// MeteoAlarm country feed → warnings (pure — unit tested). Each feed entry is
// a CAP 1.2 alert with one `info` per language; level and type come from the
// MeteoAlarm parameters, the areas from EMMA_ID geocodes. Feeds keep expired
// alerts, and an Update or Cancel replaces the alerts it references.
const TYPES = { 1: 'wind', 2: 'snow_ice', 3: 'thunderstorm', 4: 'fog', 5: 'heat', 6: 'cold', 7: 'coastal', 8: 'forest_fire', 9: 'avalanche', 10: 'rain', 12: 'flood', 13: 'rain_flood' }
export const WARNING_TYPES = [...Object.values(TYPES), 'other']

const param = (info, name) => info?.parameter?.find(p => p.valueName === name)?.value ?? null
const lead = s => Number.parseInt(String(s ?? ''), 10)
const lang2 = l => String(l ?? '').slice(0, 2).toLowerCase() || 'xx'
// CAP references: "sender,identifier,sent sender,identifier,sent …"
const referenced = refs => String(refs ?? '').trim().split(/\s+/).map(t => t.split(',')[1]).filter(Boolean)

export function parseFeed(json, country, now = Date.now()) {
  // the same identifier twice (sent again): the later one counts
  const byId = new Map()
  for (const a of (json?.warnings ?? []).map(w => w?.alert)) {
    if (!a?.identifier) continue
    const had = byId.get(a.identifier)
    if (!had || !(Date.parse(a.sent) < Date.parse(had.sent))) byId.set(a.identifier, a)
  }
  const alerts = [...byId.values()]
  const refsOf = new Map(alerts.map(a => [a.identifier, a.msgType === 'Update' || a.msgType === 'Cancel' ? referenced(a.references) : []]))
  const replaced = new Set([...refsOf.values()].flat())
  // what a warning replaces, nearest first, through Updates of Updates still in the feed
  const chain = id => {
    const out = [], todo = [...refsOf.get(id)]
    while (todo.length) { const r = todo.shift(); if (out.includes(r)) continue; out.push(r); todo.push(...(refsOf.get(r) ?? [])) }
    return out
  }
  const out = []
  for (const a of alerts) {
    if (a.msgType === 'Cancel' || a.status !== 'Actual' || replaced.has(a.identifier)) continue
    const infos = (a.info ?? []).filter(Boolean)
    const main = infos.find(i => param(i, 'awareness_level')) ?? infos[0]
    if (!main) continue
    const level = lead(param(main, 'awareness_level'))
    if (!(level >= 2 && level <= 4)) continue
    const expires = main.expires
    if (!expires || !(Date.parse(expires) > now)) continue
    const regions = [...new Set(infos.flatMap(i => (i.area ?? []).flatMap(ar => (ar.geocode ?? []).filter(g => g.valueName === 'EMMA_ID').map(g => g.value))))]
    if (!regions.length) continue
    const texts = {}
    for (const i of infos) {
      texts[lang2(i.language)] ??= { event: i.event ?? '', headline: i.headline ?? '', description: i.description ?? '', instruction: i.instruction ?? '' }
    }
    out.push({
      id: a.identifier, country, regions, level,
      type: TYPES[lead(param(main, 'awareness_type'))] ?? 'other',
      onset: main.onset ?? main.effective ?? a.sent, expires, texts,
      sender: main.senderName ?? a.sender ?? '', web: main.web ?? null, refs: chain(a.identifier),
    })
  }
  return out
}

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
  const alerts = (json?.warnings ?? []).map(w => w?.alert).filter(Boolean)
  const replaced = new Set(alerts.filter(a => a.msgType === 'Update' || a.msgType === 'Cancel').flatMap(a => referenced(a.references)))
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
      sender: main.senderName ?? a.sender ?? '', web: main.web ?? null,
    })
  }
  return out
}

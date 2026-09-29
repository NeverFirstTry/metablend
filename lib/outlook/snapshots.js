// Saves each source's outlook predictions for later verification: at most one
// 'h' snapshot per city per 6 h and one 'd' snapshot per city-local day. The
// unique (city, source, kind, slot) index settles races between instances.

import { supabase } from '../supabase.js'
import { hourlyCheckpoints, dailyCheckpoints, hourlySlot, dailySlot } from './checkpoints.js'
import { nextDueAt } from './verify.js'

export async function saveSnapshots({ city, lat, lon, region, series, utcOffsetSec, todayLocal, now = Date.now() }) {
  const hSlot = hourlySlot(now), dSlot = dailySlot(todayLocal)
  const { data: recent, error } = await supabase
    .from('outlook_snapshots')
    .select('kind, slot')
    .eq('city', city)
    .gte('issued_at', new Date(now - 1.5 * 864e5).toISOString())
  if (error) throw error
  const have = new Set((recent ?? []).map(r => `${r.kind}${r.slot}`))
  const issued_at = new Date(now).toISOString()
  const rows = []
  for (const s of series) {
    const kinds = [
      ['h', hSlot, have.has(`h${hSlot}`) ? [] : hourlyCheckpoints(s, { issuedAtMs: now, utcOffsetSec })],
      ['d', dSlot, have.has(`d${dSlot}`) ? [] : dailyCheckpoints(s, { todayLocal })],
    ]
    for (const [kind, slot, checkpoints] of kinds) {
      if (!checkpoints.length) continue
      const row = { city, lat, lon, region, source: s.id, kind, slot, issued_at, utc_offset_sec: utcOffsetSec, checkpoints, verified: {} }
      row.next_due_at = nextDueAt(row, {})
      rows.push(row)
    }
  }
  if (!rows.length) return 0
  const { error: insErr } = await supabase
    .from('outlook_snapshots')
    .upsert(rows, { onConflict: 'city,source,kind,slot', ignoreDuplicates: true })
  if (insErr) throw insErr
  return rows.length
}

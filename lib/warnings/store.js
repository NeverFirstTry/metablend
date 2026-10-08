// The warnings table (server-only; `db` is the supabase client, passed in).
// onset / expires keep the issuer's own ISO text (its local clock, shown as
// is); ends_at is the same instant as a timestamp, for filtering.
export async function saveCountry(db, country, rows, runAt) {
  const stamp = new Date(runAt).toISOString()
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(r => ({ ...r, ends_at: new Date(r.expires).toISOString(), fetched_at: stamp }))
    const { error } = await db.from('warnings').upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
  // whatever this run didn't see again is gone (expired, cancelled, replaced)
  const { error } = await db.from('warnings').delete().eq('country', country).lt('fetched_at', stamp)
  if (error) throw new Error(error.message)
}

export async function warningsIn(db, regionIds, now = Date.now()) {
  if (!regionIds.length) return []
  const { data, error } = await db
    .from('warnings')
    .select('id, country, regions, level, type, onset, expires, texts, sender, web')
    .overlaps('regions', regionIds)
    .gt('ends_at', new Date(now).toISOString())
  if (error) throw new Error(error.message)
  return data ?? []
}

// The warnings table (server-only; `db` is the supabase client, passed in).
// onset / expires keep the issuer's own ISO text (its local clock, shown as
// is); ends_at is the same instant as a timestamp, for filtering.
// An Update arrives with a new identifier; its thread is the first warning of
// the chain it continues (stored or named), so alerts go out once per thread.
// `known`: stored id → thread. Drops `refs` (not a column).
export function withThreads(rows, known) {
  const threadOf = id => known.get(id) || id
  return rows.map(({ refs = [], ...r }) => {
    const hit = refs.find(id => known.has(id))
    return { ...r, thread: known.has(r.id) ? threadOf(r.id) : hit ? threadOf(hit) : (refs.at(-1) ?? r.id) }
  })
}

async function storedThreads(db, country) {
  const known = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('warnings').select('id, thread').eq('country', country).order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) known.set(r.id, r.thread)
    if (!data || data.length < 1000) return known
  }
}

export async function saveCountry(db, country, parsed, runAt) {
  const stamp = new Date(runAt).toISOString()
  const rows = withThreads(parsed, await storedThreads(db, country))
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
    .select('id, thread, country, regions, level, type, onset, expires, texts, sender, web')
    .overlaps('regions', regionIds)
    .gt('ends_at', new Date(now).toISOString())
  if (error) throw new Error(error.message)
  return data ?? []
}

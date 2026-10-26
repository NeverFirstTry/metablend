// The 15-minute refresh (deps injected — unit tested with fakes): each
// country's feed → parseFeed → save. A feed that fails leaves that country's
// stored warnings alone (they expire on their own); the others still refresh.
import { parseFeed } from './parse.js'

export async function refreshAll({ feeds, fetchFeed, save, now = Date.now(), concurrency = 6 }) {
  const done = [], failed = []
  let next = 0
  async function worker() {
    while (next < feeds.length) {
      const [slug, country] = feeds[next++]
      try {
        const json = await fetchFeed(slug)
        if (!json) throw new Error('no answer')
        if (!Array.isArray(json.warnings)) throw new Error('not a feed') // e.g. a maintenance page
        const rows = parseFeed(json, country, now)
        await save(country, rows, now)
        done.push([country, rows.length])
      } catch (e) {
        failed.push([country, String(e?.message ?? e)])
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, feeds.length) }, worker))
  return { countries: done.length, warnings: done.reduce((s, [, n]) => s + n, 0), failed }
}

// The countries the database found changed (supabase/warnings-feeds.sql has
// already downloaded and trimmed them): parse, save, then mark each done so the
// next run skips it. A failed save stays pending and is retried next time.
export async function applyPending({ pending, save, markDone, now = Date.now() }) {
  const done = [], failed = []
  for (const { country, hash, body } of pending) {
    try {
      const rows = parseFeed(body, country, now)
      await save(country, rows, now)
      await markDone(country, hash)
      done.push([country, rows.length])
    } catch (e) {
      failed.push([country, String(e?.message ?? e)])
    }
  }
  return { countries: done.length, warnings: done.reduce((s, [, n]) => s + n, 0), failed }
}

// PostgREST's "no such table/view": the database part (warnings-feeds.sql)
// isn't set up yet.
const MISSING = new Set(['PGRST205', '42P01'])

// One refresh run. The database downloads the feeds; it lists what changed
// (warning_feeds_pending) and the feeds it couldn't get lately
// (warning_feeds_behind) — those this run downloads itself, so a feed
// MeteoAlarm won't serve to the database still refreshes, and it is logged.
// Without the database part every feed is downloaded here, as before.
export async function refreshWarnings({ readBehind, readPending, markDone, feeds, fetchFeed, save, log, now = Date.now() }) {
  const download = list => refreshAll({ feeds: list, fetchFeed, save, now })
  const behind = await readBehind()
  if (behind.error) {
    if (!MISSING.has(behind.error.code)) throw new Error(`warning_feeds_behind: ${behind.error.message}`)
    return { ...(await download(feeds)), source: 'download' }
  }
  const pending = await readPending()
  if (pending.error) throw new Error(`warning_feeds_pending: ${pending.error.message}`)
  const applied = await applyPending({ pending: pending.data, save, markDone, now })
  if (!behind.data.length) return { ...applied, source: 'database' }

  const late = new Set(behind.data.map(r => r.country))
  // once an hour (the run on the hour): Supabase can't get Cyprus' and
  // Slovakia's empty feeds at all, and a row every 15 minutes says nothing new
  if (new Date(now).getUTCMinutes() < 15) await log('warnings.database', `${late.size} feeds not downloaded by the database lately`, { feeds: behind.data.map(r => [r.country, r.last_status, r.last_error]) })
  const own = await download(feeds.filter(([, country]) => late.has(country)))
  return {
    countries: applied.countries + own.countries,
    warnings: applied.warnings + own.warnings,
    failed: [...applied.failed, ...own.failed],
    source: 'database',
    downloaded: [...late],
  }
}
